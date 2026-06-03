import os
import sys
from django.core.wsgi import get_wsgi_application
from django.core.management import call_command

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'yeedem_project.settings')
application = get_wsgi_application()

# Attempt to run migrations on startup (common pattern for Vercel/Neon)
# We check for an environment variable to avoid running this during local development runserver
if os.environ.get('VERCEL'):
    try:
        print("WSGI: Attempting to run migrations...")
        call_command('migrate', no_input=True)
        print("WSGI: Migrations completed successfully.")
    except Exception as e:
        print(f"WSGI: Migration failed: {e}", file=sys.stderr)
