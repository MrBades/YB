from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.db.models import Sum, F, Q, ExpressionWrapper, DecimalField
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.contrib.auth.models import User
from django.core.management import call_command
import io

from .models import (
    BusinessProfile, Customer, Product, LowStockNotification,
    Invoice, InvoiceItem, SupplierRecord, InventoryIntakeLog,
    MerchantSession, LedgerBackup, Staff, StaffActivityLog
)
from .serializers import (
    UserSerializer, BusinessProfileSerializer, CustomerSerializer, 
    ProductSerializer, InvoiceSerializer, SupplierRecordSerializer, 
    InventoryIntakeLogSerializer, LowStockNotificationSerializer
)
from .utils import parse_multimodal_smart_input, parse_multimodal_smart_product


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
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        session_id = request.headers.get('x-session-id')
        user = None
        if session_id and session_id not in ["null", "undefined", ""]:
            user, err = get_session_user(request)
            if err:
                return Response({"error": err}, status=status.HTTP_401_UNAUTHORIZED)

        text_prompt = request.data.get("text", "").strip()
        image_file = request.FILES.get("image")
        audio_file = request.FILES.get("audio")

        if not text_prompt and not image_file and not audio_file:
            return Response(
                {"error": "Please provide a text entry, voice note, or physical receipt image."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            parsed_data, extraction_status = parse_multimodal_smart_input(
                text=text_prompt,
                image_file=image_file,
                audio_file=audio_file
            )

            response_payload = {
                "status": extraction_status,
                "parsed_data": parsed_data
            }

            if user:
                # Retrieve business model
                profile = get_object_or_404(BusinessProfile, user=user)

                # Auto create/match the customer
                customer_name = parsed_data.get("customer_name") or "Walk-in Customer"
                customer, created = Customer.objects.get_or_create(
                    business=profile,
                    name=customer_name
                )
                response_payload["matched_customer"] = {
                    "id": customer.id,
                    "name": customer.name,
                    "active_debt": float(customer.active_debt_balance)
                }

            return Response(response_payload)
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


class SmartProductProcessorAPIView(APIView):
    """
    Smart Product Extraction Endpoint.
    """
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        session_id = request.headers.get('x-session-id')
        user = None
        if session_id and session_id not in ["null", "undefined", ""]:
            user, err = get_session_user(request)
            if err:
                return Response({"error": err}, status=status.HTTP_401_UNAUTHORIZED)

        text_prompt = request.data.get("text", "").strip()

        if not text_prompt:
            return Response(
                {"error": "Please provide a product description text."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            parsed_data, extraction_status = parse_multimodal_smart_product(text=text_prompt)
            return Response({
                "status": extraction_status,
                "parsed_data": parsed_data
            })
        except Exception as e:
            return Response({
                "status": "fallback_error",
                "error": str(e),
                "parsed_data": {
                    "name": "General Commodity",
                    "sku": "SKU-PROD",
                    "stock": 10,
                    "price": 0.0
                }
            }, status=status.HTTP_200_OK)


class DashboardMetricsAPIView(APIView):
    """
    Provides real-time aggregated metrics for the SME Ledger dashboard view.
    """
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        user, err = get_session_user(request)
        if err:
            return Response({"error": err}, status=status.HTTP_401_UNAUTHORIZED)

        profile = get_object_or_404(BusinessProfile, user=user)

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


import re

def normalize_contact(phone_or_email):
    if not isinstance(phone_or_email, str):
        return ""
    input_str = phone_or_email.strip()
    if not input_str:
        return ""

    clean_phone_check = re.sub(r'[\s\-()]', '', input_str)
    is_email = "@" in input_str and "." in input_str
    is_phone = bool(re.match(r'^\+?[0-9]{8,15}$', clean_phone_check))

    if is_phone and not is_email:
        if clean_phone_check.startswith("0") and len(clean_phone_check) == 11:
            return "+234" + clean_phone_check[1:]
        elif not clean_phone_check.startswith("+") and not clean_phone_check.startswith("0") and len(clean_phone_check) == 10:
            return "+234" + clean_phone_check
        else:
            return ("+" if clean_phone_check.startswith("+") else "") + re.sub(r'\D', '', clean_phone_check)
    return input_str


def get_approx_region(request):
    header_region = request.headers.get('x-approx-region')
    if header_region:
        return header_region
    
    x_forwarded_for = request.headers.get('x-forwarded-for')
    if x_forwarded_for:
        client_ip = x_forwarded_for.split(',')[0].strip()
    else:
        client_ip = request.META.get('REMOTE_ADDR', '')
        
    if '127.0.0.1' in client_ip or 'localhost' in client_ip or client_ip.startswith('::'):
        return 'NG-Lagos'
    if client_ip.startswith('10.0.') or client_ip.startswith('172.'):
        return 'NG-Abuja'
    if client_ip.startswith('8.8.8.'):
        return 'US-California'
    return 'NG-Lagos'


def get_client_ip(request):
    x_forwarded_for = request.headers.get('x-forwarded-for')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '127.0.0.1')


def get_session_user(request):
    session_id = request.headers.get('x-session-id')
    if not session_id:
        return None, "Session required"
    try:
        session = MerchantSession.objects.get(session_id=session_id)
        if session.is_suspicious_locked:
            return None, "Suspicious activity detected. Session locked. Re-authenticate via OTP."
        
        # Micro device fingerprint mismatch check
        device_fingerprint = request.headers.get('x-device-fingerprint', 'unknown_fp')
        approx_region = get_approx_region(request)
        
        is_mismatched = False
        if device_fingerprint and device_fingerprint not in ['unknown_fp', 'unknown']:
            if session.device_fingerprint in ['fp_default_owner', '']:
                session.device_fingerprint = device_fingerprint
                session.save()
            elif device_fingerprint != 'fp_default_owner' and session.device_fingerprint != device_fingerprint:
                is_mismatched = True

        if is_mismatched and device_fingerprint and device_fingerprint not in ['unknown', 'unknown_fp']:
            session.is_suspicious_locked = True
            session.save()
            return None, "Suspicious activity detected. Session locked. Re-authenticate via OTP."
            
        return session.user, None
    except MerchantSession.DoesNotExist:
        return None, "Invalid session"


class ProbeAuthView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        raw_phone_or_email = request.data.get('phone_or_email') or request.data.get('phone_or_email') or request.data.get('phone_or_email')
        # In server.ts request body has phone_or_email
        phone_or_email = normalize_contact(raw_phone_or_email)
        if not phone_or_email:
            return Response({"error": "Missing phone_or_email"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Find or create User
        try:
            user = User.objects.get(username=phone_or_email)
        except User.DoesNotExist:
            user = User.objects.create_user(username=phone_or_email, email=phone_or_email if '@' in phone_or_email else "")
            
        profile, created = BusinessProfile.objects.get_or_create(user=user)
        
        is_new_user = not profile.full_name or profile.full_name == "Merchant" or not profile.business_name or profile.business_name == "My Business"
        has_pin = bool(profile.owner_pin)
        
        return Response({
            "newUser": is_new_user,
            "hasPin": has_pin
        })


class VerifyOtpView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        raw_phone_or_email = request.data.get('phone_or_email')
        otp = request.data.get('otp')
        phone_or_email = normalize_contact(raw_phone_or_email)
        
        if not phone_or_email:
            return Response({"error": "Missing contact information"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(username=phone_or_email)
        except User.DoesNotExist:
            return Response({"error": "User profile not found"}, status=status.HTTP_404_NOT_FOUND)

        if otp == '1234':
            session_id = str(int(timezone.now().timestamp() * 1000))
            
            # Clear old merchant sessions
            MerchantSession.objects.filter(user=user).delete()
            
            device_fingerprint = request.headers.get('x-device-fingerprint', 'unknown_fp')
            approx_region = get_approx_region(request)
            client_ip = get_client_ip(request)
            
            session = MerchantSession.objects.create(
                session_id=session_id,
                user=user,
                device_fingerprint=device_fingerprint,
                last_active_ip=client_ip,
                last_active_region=approx_region,
                is_suspicious_locked=False
            )
            
            profile, _ = BusinessProfile.objects.get_or_create(user=user)
            is_new_user = not profile.full_name or profile.full_name == "Merchant"
            needs_pin = not profile.owner_pin
            
            user_data = {
                "id": str(user.id),
                "phone_or_email": phone_or_email,
                "full_name": profile.full_name or "Merchant",
                "business_name": profile.business_name or "My Business",
                "business_type": profile.business_type or "buy_and_sell"
            }
            
            return Response({
                "status": "success",
                "session_id": session_id,
                "is_new_user": is_new_user,
                "needs_pin": needs_pin,
                "user": user_data
            })
        else:
            return Response({"error": "Invalid 4-digit OTP"}, status=status.HTTP_401_UNAUTHORIZED)


class RegisterOnboardingView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        user, err = get_session_user(request)
        if err:
            return Response({"error": err}, status=status.HTTP_401_UNAUTHORIZED)
            
        pin = request.data.get('pin') or request.data.get('owner_pin')
        full_name = request.data.get('full_name')
        business_name = request.data.get('business_name')
        business_type = request.data.get('business_type')
        phone = request.data.get('phone')
        address = request.data.get('address')
        template = request.data.get('template') or 'classic'

        profile, _ = BusinessProfile.objects.get_or_create(user=user)
        
        if pin:
            profile.owner_pin = pin
        if full_name:
            profile.full_name = full_name
        if business_name:
            profile.business_name = business_name
        if business_type:
            profile.business_type = business_type
        if phone:
            profile.phone_number = phone
        if address:
            profile.address = address
            
        profile.invoice_template_preference = template
        profile.shop_slug = (business_name or profile.business_name or "My Business").lower().replace(' ', '-')
        profile.save()

        # Update standard User model fields if needed
        if full_name:
            parts = full_name.split(' ', 1)
            user.first_name = parts[0]
            if len(parts) > 1:
                user.last_name = parts[1]
            user.save()

        # Format business configuration dictionary
        business_config = {
            "businessName": profile.business_name,
            "businessType": profile.business_type,
            "phone": profile.phone_number or '',
            "address": profile.address or '',
            "invoiceTemplatePreference": profile.invoice_template_preference,
            "customAccentColor": profile.custom_accent_color,
            "customFontSize": profile.custom_font_size,
            "customFontFamily": profile.custom_font_family,
            "customShowLogo": profile.custom_show_logo,
            "customHeaderTitle": profile.custom_header_title or 'TAX INVOICE',
            "customFooterNotes": profile.custom_footer_notes or 'This document acts as an official trade journal entry. Please verify balances online.',
            "customShadowStyle": profile.custom_shadow_style
        }

        user_data = {
            "id": str(user.id),
            "phone_or_email": user.username,
            "full_name": profile.full_name or "Merchant",
            "business_name": profile.business_name,
            "business_type": profile.business_type,
            "owner_pin": profile.owner_pin,
            "phone": profile.phone_number or '',
            "address": profile.address or '',
            "shop_slug": profile.shop_slug,
            "business": business_config
        }

        return Response({
            "status": "success",
            "user": user_data
        })


class SetPinView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        raw_phone_or_email = request.data.get('phone_or_email')
        pin = request.data.get('pin')
        phone_or_email = normalize_contact(raw_phone_or_email)

        try:
            user = User.objects.get(username=phone_or_email)
            profile, _ = BusinessProfile.objects.get_or_create(user=user)
            profile.owner_pin = pin
            profile.save()
            return Response({"status": "success", "message": "PIN set successfully"})
        except User.DoesNotExist:
            return Response({"error": "User profile not found."}, status=status.HTTP_404_NOT_FOUND)


class PinLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        raw_phone_or_email = request.data.get('phone_or_email')
        pin = request.data.get('pin')
        phone_or_email = normalize_contact(raw_phone_or_email)
        
        device_fingerprint = request.headers.get('x-device-fingerprint', 'unknown_fp')
        approx_region = get_approx_region(request)
        client_ip = get_client_ip(request)

        try:
            user = User.objects.get(username=phone_or_email)
        except User.DoesNotExist:
            return Response({"error": "Merchant profile not found on this device."}, status=status.HTTP_404_NOT_FOUND)

        profile, _ = BusinessProfile.objects.get_or_create(user=user)

        if profile.owner_pin != pin:
            return Response({"error": "Incorrect 4-digit security PIN."}, status=status.HTTP_401_UNAUTHORIZED)

        session_id = str(int(timezone.now().timestamp() * 1000))
        is_suspicious_locked = False

        # Anomaly checks mirroring server.ts exactly
        prev_sessions = MerchantSession.objects.filter(user=user)
        if prev_sessions.exists():
            first_session = prev_sessions.first()
            usual_device = first_session.device_fingerprint
            usual_region = first_session.last_active_region

            if usual_device and usual_device != device_fingerprint:
                is_suspicious_locked = True
                print(f"[ANOMALY TRIGGER] Unrecognized hardware footprint: cur={device_fingerprint}, expected={usual_device}")
            elif usual_region and usual_region != 'Unknown' and approx_region != 'Unknown' and usual_region != approx_region:
                is_suspicious_locked = True
                print(f"[ANOMALY TRIGGER] Geographic shift detected: cur={approx_region}, expected={usual_region}")

        # Delete previous sessions
        MerchantSession.objects.filter(user=user).delete()

        # Create new session
        MerchantSession.objects.create(
            session_id=session_id,
            user=user,
            device_fingerprint=device_fingerprint,
            last_active_ip=client_ip,
            last_active_region=approx_region,
            is_suspicious_locked=is_suspicious_locked
        )

        business_config = {
            "businessName": profile.business_name,
            "businessType": profile.business_type,
            "phone": profile.phone_number or '',
            "address": profile.address or '',
            "invoiceTemplatePreference": profile.invoice_template_preference,
            "customAccentColor": profile.custom_accent_color,
            "customFontSize": profile.custom_font_size,
            "customFontFamily": profile.custom_font_family,
            "customShowLogo": profile.custom_show_logo,
            "customHeaderTitle": profile.custom_header_title or 'TAX INVOICE',
            "customFooterNotes": profile.custom_footer_notes or 'This document acts as an official trade journal entry. Please verify balances online.',
            "customShadowStyle": profile.custom_shadow_style
        }

        user_data = {
            "id": str(user.id),
            "phone_or_email": user.username,
            "full_name": profile.full_name or "Merchant",
            "business_name": profile.business_name,
            "business_type": profile.business_type,
            "owner_pin": profile.owner_pin,
            "phone": profile.phone_number or user.username,
            "address": profile.address or '',
            "shop_slug": profile.shop_slug or '',
            "business": business_config
        }

        return Response({
            "status": "locked" if is_suspicious_locked else "success",
            "session_id": session_id,
            "is_suspicious_locked": is_suspicious_locked,
            "user": user_data
        })


class ResetForgottenPinView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        raw_phone_or_email = request.data.get('phone_or_email')
        otp = request.data.get('otp')
        pin = request.data.get('pin')
        phone_or_email = normalize_contact(raw_phone_or_email)

        if not phone_or_email or not pin:
            return Response({"error": "Missing required fields"}, status=status.HTTP_400_BAD_REQUEST)

        if otp != '1234':
            return Response({"error": "Invalid 4-digit OTP"}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            user = User.objects.get(username=phone_or_email)
            profile, _ = BusinessProfile.objects.get_or_create(user=user)
            profile.owner_pin = pin
            profile.save()
            return Response({"status": "success", "message": "PIN reset successfully"})
        except User.DoesNotExist:
            return Response({"error": "User profile not found."}, status=status.HTTP_404_NOT_FOUND)


class ValidateSessionView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        user, err = get_session_user(request)
        if err:
            return Response({"status": "error", "error": err}, status=status.HTTP_401_UNAUTHORIZED)

        profile, _ = BusinessProfile.objects.get_or_create(user=user)

        business_config = {
            "businessName": profile.business_name,
            "businessType": profile.business_type,
            "phone": profile.phone_number or '',
            "address": profile.address or '',
            "invoiceTemplatePreference": profile.invoice_template_preference,
            "customAccentColor": profile.custom_accent_color,
            "customFontSize": profile.custom_font_size,
            "customFontFamily": profile.custom_font_family,
            "customShowLogo": profile.custom_show_logo,
            "customHeaderTitle": profile.custom_header_title or 'TAX INVOICE',
            "customFooterNotes": profile.custom_footer_notes or 'This document acts as an official trade journal entry. Please verify balances online.',
            "customShadowStyle": profile.custom_shadow_style
        }

        user_data = {
            "id": str(user.id),
            "phone_or_email": user.username,
            "full_name": profile.full_name or "Merchant",
            "business_name": profile.business_name,
            "business_type": profile.business_type,
            "owner_pin": profile.owner_pin,
            "phone": profile.phone_number or user.username,
            "address": profile.address or '',
            "shop_slug": profile.shop_slug or '',
            "business": business_config
        }

        return Response({
            "status": "success",
            "user": user_data
        })


class VerifySuspiciousOtpView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        raw_phone_or_email = request.data.get('phone_or_email')
        otp = request.data.get('otp')
        phone_or_email = normalize_contact(raw_phone_or_email)

        if otp != '1234':
            return Response({"error": "Invalid OTP"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(username=phone_or_email)
            sessions = MerchantSession.objects.filter(user=user)
            for s in sessions:
                s.is_suspicious_locked = False
                s.save()
            return Response({"status": "success", "message": "Verification successful."})
        except User.DoesNotExist:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)


class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        session_id = request.headers.get('x-session-id')
        if session_id:
            MerchantSession.objects.filter(session_id=session_id).delete()
        return Response({"status": "success", "message": "Logged out successfully"})


class UnlockAllView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        MerchantSession.objects.all().update(is_suspicious_locked=False)
        return Response({"status": "success", "message": "All sessions unlocked."})


class BusinessSettingsView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        user, err = get_session_user(request)
        if err:
            return Response({"error": err}, status=status.HTTP_401_UNAUTHORIZED)

        business_data = request.data.get('business', {})
        profile, _ = BusinessProfile.objects.get_or_create(user=user)

        if business_data:
            profile.business_name = business_data.get('businessName', profile.business_name)
            profile.business_type = business_data.get('businessType', profile.business_type)
            profile.phone_number = business_data.get('phone', profile.phone_number)
            profile.address = business_data.get('address', profile.address)
            profile.invoice_template_preference = business_data.get('invoiceTemplatePreference', profile.invoice_template_preference)
            profile.custom_accent_color = business_data.get('customAccentColor', profile.custom_accent_color)
            profile.custom_font_size = business_data.get('customFontSize', profile.custom_font_size)
            profile.custom_font_family = business_data.get('customFontFamily', profile.custom_font_family)
            profile.custom_show_logo = business_data.get('customShowLogo', profile.custom_show_logo)
            profile.custom_header_title = business_data.get('customHeaderTitle', profile.custom_header_title)
            profile.custom_footer_notes = business_data.get('customFooterNotes', profile.custom_footer_notes)
            profile.custom_shadow_style = business_data.get('customShadowStyle', profile.custom_shadow_style)
            profile.shop_slug = profile.business_name.lower().replace(' ', '-')
            profile.save()

        return Response({"status": "success", "message": "Settings saved completely."})


class BackupSaveView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        user, err = get_session_user(request)
        if err:
            return Response({"error": err}, status=status.HTTP_401_UNAUTHORIZED)

        email = request.data.get('email', user.username)
        backup_data = request.data.get('backupData')

        if not backup_data:
            return Response({"error": "No data layout backup supplied"}, status=status.HTTP_400_BAD_REQUEST)

        safe_email = re.sub(r'[^a-zA-Z0-9]', '_', email)
        filename = f"backup_{safe_email}_{int(timezone.now().timestamp() * 1000)}.json"

        LedgerBackup.objects.create(
            user=user,
            filename=filename,
            backup_data=backup_data
        )

        return Response({
            "status": "success",
            "message": "Ledger backup written to database storage successfully.",
            "filename": filename,
            "timestamp": timezone.now().isoformat()
        })


class BackupListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        user, err = get_session_user(request)
        if err:
            return Response({"error": err}, status=status.HTTP_401_UNAUTHORIZED)

        backups = LedgerBackup.objects.filter(user=user)
        user_backups = []
        for b in backups:
            user_backups.append({
                "filename": b.filename,
                "createdAt": b.created_at.isoformat(),
                "source": "server"
            })

        return Response(user_backups)


class BackupDownloadView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, filename):
        user, err = get_session_user(request)
        if err:
            return Response({"error": err}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            backup = LedgerBackup.objects.get(user=user, filename=filename)
            return Response(backup.backup_data)
        except LedgerBackup.DoesNotExist:
            return Response({"error": "Backup not found"}, status=status.HTTP_404_NOT_FOUND)


class BackupDeleteView(APIView):
    permission_classes = [AllowAny]

    def delete(self, request, filename):
        user, err = get_session_user(request)
        if err:
            return Response({"error": err}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            LedgerBackup.objects.filter(user=user, filename=filename).delete()
            return Response({"status": "success", "message": "Automated backup deleted from storage successfully."})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class GuestInvoiceGenerateView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        return Response({"status": "success", "count": 1})


class TerminalPinVerifyView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, shop_slug, worker_slug):
        pin = request.data.get('pin')
        try:
            staff = Staff.objects.get(name_slug=worker_slug, is_active=True)
            if staff.owner_generated_pin == pin:
                StaffActivityLog.objects.create(
                    user=staff.user,
                    staff=staff,
                    action_taken='PIN_LOGIN',
                    is_flagged=False
                )
                return Response({
                    "status": "success",
                    "staff": {
                        "id": staff.id,
                        "real_name": staff.real_name,
                        "name_slug": staff.name_slug
                    }
                })
            else:
                return Response({"error": "Invalid Pin"}, status=status.HTTP_401_UNAUTHORIZED)
        except Staff.DoesNotExist:
            return Response({"error": "Staff profile not found"}, status=status.HTTP_404_NOT_FOUND)


class StaffListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        user, err = get_session_user(request)
        if err:
            return Response({"error": err}, status=status.HTTP_401_UNAUTHORIZED)

        staff_members = Staff.objects.filter(user=user)
        data = [{
            "id": s.id,
            "real_name": s.real_name,
            "name_slug": s.name_slug,
            "owner_generated_pin": s.owner_generated_pin,
            "is_active": s.is_active,
            "shop_id": s.shop_id,
            "created_at": s.created_at.isoformat()
        } for s in staff_members]
        return Response(data)

    def post(self, request):
        user, err = get_session_user(request)
        if err:
            return Response({"error": err}, status=status.HTTP_401_UNAUTHORIZED)

        name = request.data.get('real_name') or request.data.get('name') or ''
        pin = request.data.get('owner_generated_pin') or ''
        name_slug = re.sub(r'[^a-z0-9-_]', '', name.lower().replace(' ', '-'))

        staff = Staff.objects.create(
            user=user,
            real_name=name,
            name_slug=name_slug,
            owner_generated_pin=pin,
            is_active=True,
            shop_id=request.data.get('shop_id', 'default_shop')
        )

        return Response({
            "status": "success",
            "staff": {
                "id": staff.id,
                "real_name": staff.real_name,
                "name_slug": staff.name_slug,
                "owner_generated_pin": staff.owner_generated_pin,
                "is_active": staff.is_active
            }
        })


class StaffLogView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        user, err = get_session_user(request)
        if err:
            return Response({"error": err}, status=status.HTTP_401_UNAUTHORIZED)

        logs = StaffActivityLog.objects.filter(user=user)
        data = [{
            "id": l.id,
            "staff_id": l.staff.id if l.staff else None,
            "action_taken": l.action_taken,
            "timestamp": int(l.timestamp.timestamp() * 1000),
            "is_flagged": l.is_flagged
        } for l in logs]
        return Response(data)

    def post(self, request):
        session_id = request.headers.get('x-session-id')
        user = None
        if session_id:
            try:
                session = MerchantSession.objects.get(session_id=session_id)
                user = session.user
            except MerchantSession.DoesNotExist:
                pass
        
        if not user:
            return Response({"error": "Could not associate session"}, status=status.HTTP_401_UNAUTHORIZED)

        action_taken = request.data.get('action') or request.data.get('action_taken') or 'ACTIVITY'
        StaffActivityLog.objects.create(
            user=user,
            action_taken=action_taken,
            is_flagged=False
        )
        return Response({"status": "success"})


class SystemMigrateView(APIView):
    """
    Emergency endpoint to trigger database migrations.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        output = io.StringIO()
        try:
            call_command('migrate', no_input=True, stdout=output)
            result = output.getvalue()
            return Response({"status": "success", "output": result})
        except Exception as e:
            return Response({"status": "error", "message": str(e)}, status=500)
