from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    BusinessProfileViewSet, CustomerViewSet, ProductViewSet,
    InvoiceViewSet, SupplierRecordViewSet, InventoryIntakeLogViewSet,
    LowStockNotificationViewSet, SmartInputProcessorAPIView,
    DashboardMetricsAPIView
)

router = DefaultRouter()
router.register(r'business-profiles', BusinessProfileViewSet, basename='business-profile')
router.register(r'customers', CustomerViewSet, basename='customer')
router.register(r'products', ProductViewSet, basename='product')
router.register(r'invoices', InvoiceViewSet, basename='invoice')
router.register(r'suppliers', SupplierRecordViewSet, basename='supplier')
router.register(r'inventory-intakes', InventoryIntakeLogViewSet, basename='inventory-intake')
router.register(r'notifications', LowStockNotificationViewSet, basename='notification')

urlpatterns = [
    path('', include(router.urls)),
    path('smart-input/', SmartInputProcessorAPIView.as_view(), name='smart-input'),
    path('dashboard-metrics/', DashboardMetricsAPIView.as_view(), name='dashboard-metrics'),
]
