"""Finance URL routing.

All private finance endpoints are registered on a DefaultRouter. The public
receipt verification endpoint lives under ``public/receipts/{code}/verify``.
"""
from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.finance.views import (
    BudgetItemViewSet,
    ExpenseViewSet,
    InKindContributionViewSet,
    PaymentViewSet,
    ProjectBudgetViewSet,
    PublicReceiptVerifyViewSet,
    ReceiptViewSet,
    RevenueViewSet,
    SupplierViewSet,
)

router = DefaultRouter()
router.register("suppliers", SupplierViewSet, basename="supplier")
router.register("payments", PaymentViewSet, basename="payment")
router.register("revenues", RevenueViewSet, basename="revenue")
router.register("inkind", InKindContributionViewSet, basename="inkind")
router.register("expenses", ExpenseViewSet, basename="expense")
router.register("budgets", ProjectBudgetViewSet, basename="budget")
router.register("budget-items", BudgetItemViewSet, basename="budget-item")
router.register("receipts", ReceiptViewSet, basename="receipt")

# Public verification endpoint (AllowAny).
public_verify = PublicReceiptVerifyViewSet.as_view({"get": "verify"})

urlpatterns = router.urls + [
    path(
        "public/receipts/<str:code>/verify/",
        public_verify,
        name="public-receipt-verify",
    ),
]
