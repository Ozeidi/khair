"""Thread-local access to the current request so services can attribute audit
entries to the acting user + IP without threading the request everywhere."""
import threading

_state = threading.local()


def get_current_request():
    return getattr(_state, "request", None)


def get_current_user():
    request = get_current_request()
    if request and hasattr(request, "user") and request.user.is_authenticated:
        return request.user
    return None


class CurrentRequestMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        _state.request = request
        try:
            return self.get_response(request)
        finally:
            _state.request = None
