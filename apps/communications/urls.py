from rest_framework.routers import DefaultRouter

from apps.communications.views import (
    CampaignViewSet,
    NotificationViewSet,
    OutboxMessageViewSet,
    WhatsAppTemplateViewSet,
)

router = DefaultRouter()
router.register("templates", WhatsAppTemplateViewSet, basename="template")
router.register("outbox", OutboxMessageViewSet, basename="outbox")
router.register("notifications", NotificationViewSet, basename="notification")
router.register("campaigns", CampaignViewSet, basename="campaign")

urlpatterns = router.urls
