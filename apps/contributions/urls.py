"""مسارات تطبيق الأسهم والاشتراكات."""
from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.contributions.views import (
    InstallmentViewSet,
    PublicShareTypeViewSet,
    ShareTypeViewSet,
    SubscriptionViewSet,
)

router = DefaultRouter()
router.register("share-types", ShareTypeViewSet, basename="share-type")
router.register("subscriptions", SubscriptionViewSet, basename="subscription")
router.register("installments", InstallmentViewSet, basename="installment")

urlpatterns = router.urls + [
    # قراءة عامة لأنواع الأسهم النشطة لمشروع عبر public_slug.
    path(
        "public/projects/<slug:project_slug>/share-types/",
        PublicShareTypeViewSet.as_view({"get": "list"}),
        name="public-project-share-types",
    ),
]
