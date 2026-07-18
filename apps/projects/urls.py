from rest_framework.routers import DefaultRouter

from apps.projects.views import (
    ProjectCategoryViewSet,
    ProjectStageViewSet,
    ProjectUpdateViewSet,
    ProjectViewSet,
    PublicCategoryViewSet,
    PublicProjectViewSet,
    PublicStatsViewSet,
    TransparencyViewSet,
)

router = DefaultRouter()

# Staff / management routes
router.register("projects", ProjectViewSet, basename="project")
router.register("project-stages", ProjectStageViewSet, basename="project-stage")
router.register("project-updates", ProjectUpdateViewSet, basename="project-update")
router.register("categories", ProjectCategoryViewSet, basename="category")
router.register("transparency", TransparencyViewSet, basename="transparency")

# Public (AllowAny) routes
router.register("public/projects", PublicProjectViewSet, basename="public-project")
router.register("public/categories", PublicCategoryViewSet, basename="public-category")
router.register("public/stats", PublicStatsViewSet, basename="public-stats")

urlpatterns = router.urls
