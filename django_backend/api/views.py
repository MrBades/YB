from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.db.models import Sum, F, Q, ExpressionWrapper, DecimalField
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.contrib.auth.models import User

from .models import (
    BusinessProfile, Customer, Product, LowStockNotification,
    Invoice, InvoiceItem, SupplierRecord, InventoryIntakeLog
)
from .serializers import (
    UserSerializer, BusinessProfileSerializer, CustomerSerializer, 
    ProductSerializer, InvoiceSerializer, SupplierRecordSerializer, 
    InventoryIntakeLogSerializer, LowStockNotificationSerializer
)
from .utils import parse_multimodal_smart_input


class BusinessProfileViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = BusinessProfileSerializer

    def get_queryset(self):
        return BusinessProfile.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class CustomerViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = CustomerSerializer

    def get_queryset(self):
        # Enforce multi-tenant business-specific segregation
        profile = getattr(self.request.user, 'business_profile', None)
        if not profile:
            return Customer.objects.none()
        return Customer.objects.filter(business=profile)

    def perform_create(self, serializer):
        profile = get_object_or_404(BusinessProfile, user=self.request.user)
        serializer.save(business=profile)


class ProductViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ProductSerializer

    def get_queryset(self):
        profile = getattr(self.request.user, 'business_profile', None)
        if not profile:
            return Product.objects.none()
        return Product.objects.filter(business=profile)

    def perform_create(self, serializer):
        profile = get_object_or_404(BusinessProfile, user=self.request.user)
        product = serializer.save(business=profile)
        product.check_low_stock()


class InvoiceViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = InvoiceSerializer

    def get_queryset(self):
        profile = getattr(self.request.user, 'business_profile', None)
        if not profile:
            return Invoice.objects.none()
        return Invoice.objects.filter(business=profile)

    def perform_create(self, serializer):
        profile = get_object_or_404(BusinessProfile, user=self.request.user)
        # Match customer based on incoming data
        customer_id = self.request.data.get('customer')
        customer = get_object_or_404(Customer, id=customer_id, business=profile)
        serializer.save(business=profile, customer=customer)


class SupplierRecordViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = SupplierRecordSerializer

    def get_queryset(self):
        profile = getattr(self.request.user, 'business_profile', None)
        if not profile:
            return SupplierRecord.objects.none()
        return SupplierRecord.objects.filter(business=profile)

    def perform_create(self, serializer):
        profile = get_object_or_404(BusinessProfile, user=self.request.user)
        serializer.save(business=profile)


class InventoryIntakeLogViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = InventoryIntakeLogSerializer

    def get_queryset(self):
        profile = getattr(self.request.user, 'business_profile', None)
        if not profile:
            return InventoryIntakeLog.objects.none()
        return InventoryIntakeLog.objects.filter(product__business=profile)


class LowStockNotificationViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = LowStockNotificationSerializer

    def get_queryset(self):
        profile = getattr(self.request.user, 'business_profile', None)
        if not profile:
            return LowStockNotification.objects.none()
        return LowStockNotification.objects.filter(business=profile)

    @action(detail=False, methods=['post'], url_path='mark-all-read')
    def mark_all_read(self, request):
        profile = get_object_or_404(BusinessProfile, user=request.user)
        LowStockNotification.objects.filter(business=profile, is_read=False).update(is_read=True)
        return Response({"status": "success", "message": "All warnings marked as read."})


class SmartInputProcessorAPIView(APIView):
    """
    Multimodal Smart Input Endpoint. Receives text, image base64, or audio file,
    runs the AI (or Regex fallback), creates the customer and invoice records implicitly,
    and returns parsed, structured data.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        text_prompt = request.data.get("text", "").strip()
        image_file = request.FILES.get("image")
        audio_file = request.FILES.get("audio")

        if not text_prompt and not image_file and not audio_file:
            return Response(
                {"error": "Please provide a text entry, voice note, or physical receipt image."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            parsed_data = parse_multimodal_smart_input(
                text=text_prompt,
                image_file=image_file,
                audio_file=audio_file
            )

            # Retrieve business model
            profile = get_object_or_404(BusinessProfile, user=request.user)

            # Auto create/match the customer
            customer_name = parsed_data.get("customer_name") or "Walk-in Customer"
            customer, created = Customer.objects.get_or_create(
                business=profile,
                name=customer_name
            )

            return Response({
                "status": "success",
                "parsed_data": parsed_data,
                "matched_customer": {
                    "id": customer.id,
                    "name": customer.name,
                    "active_debt": float(customer.active_debt_balance)
                }
            })
        except Exception as e:
            return Response({
                "status": "fallback_error",
                "error": str(e),
                "parsed_data": {
                    "product_name": "General Goods",
                    "customer_name": "Walk-in Customer",
                    "items": [],
                    "total_amount": 0.0,
                    "amount_paid": 0.0,
                    "debt_balance": 0.0,
                    "transaction_type": "sale"
                }
            }, status=status.HTTP_200_OK)


class DashboardMetricsAPIView(APIView):
    """
    Provides real-time aggregated metrics for the SME Ledger dashboard view.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        profile = get_object_or_404(BusinessProfile, user=request.user)

        # 1. Total outstanding loans
        outstanding_loan_aggregate = Customer.objects.filter(
            business=profile
        ).aggregate(total_debt=Sum('active_debt_balance'))
        total_outstanding_debt = outstanding_loan_aggregate.get('total_debt') or 0.00

        # 2. Financial sales breakdown
        invoices = Invoice.objects.filter(business=profile)
        total_sales = invoices.aggregate(total=Sum('total_amount')).get('total') or 0.00
        total_paid = invoices.aggregate(paid=Sum('amount_paid')).get('paid') or 0.00

        # 3. Product catalog counting
        products = Product.objects.filter(business=profile)
        total_products = products.count()
        low_stock_count = products.filter(stock__lte=F('min_quantity_count')).count()

        # 4. Aging summary calculations (over 30 days old vs under 30 days)
        now = timezone.now()
        thirty_days_ago = now - timezone.timedelta(days=30)
        
        recent_debt = invoices.filter(
            created_at__gte=thirty_days_ago
        ).aggregate(debt=Sum('debt_balance')).get('debt') or 0.00
        
        aged_debt = max(0.00, float(total_outstanding_debt) - float(recent_debt))

        return Response({
            "metrics": {
                "total_outstanding_debt": float(total_outstanding_debt),
                "total_sales": float(total_sales),
                "total_paid": float(total_paid),
                "total_products": total_products,
                "low_stock_count": low_stock_count,
                "recent_debt": float(recent_debt),
                "aged_over_30_debt": float(aged_debt)
            }
        })
