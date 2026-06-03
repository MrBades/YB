#!/bin/bash

echo "===> INSTALLING REQUIREMENTS"
python3.12 -m pip install -r requirements.txt --break-system-packages

echo "===> RUNNING MIGRATIONS"
python3.12 manage.py migrate --noinput

echo "===> CREATING/UPDATING ADMIN ACCOUNT"
if [ -f create_superuser.py ]; then
    python3.12 create_superuser.py
else
    echo "create_superuser.py not found, skipping."
fi

echo "===> COLLECTING STATIC"
python3.12 manage.py collectstatic --noinput --clear

echo "===> BUILD FINISHED"
