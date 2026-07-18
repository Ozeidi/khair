from rest_framework.routers import DefaultRouter

from apps.organizations.views import (
    OrganizationDocumentViewSet,
    OrganizationMemberViewSet,
    OrganizationViewSet,
    PublicOrganizationViewSet,
)

router = DefaultRouter()
router.register("organizations", OrganizationViewSet, basename="organization")
router.register(
    "organization-members",
    OrganizationMemberViewSet,
    basename="organization-member",
)
router.register(
    "organization-documents",
    OrganizationDocumentViewSet,
    basename="organization-document",
)
router.register(
    "public/organizations",
    PublicOrganizationViewSet,
    basename="public-organization",
)

urlpatterns = router.urls
