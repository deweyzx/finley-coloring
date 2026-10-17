@echo off
rem Double-click this to import the images in the "import" folder as coloring pages.
cd /d "%~dp0"

rem The importer needs two free Python add-ons (Pillow and NumPy). Install them the first time only.
python -c "import PIL, numpy" 2>nul || (
  echo Installing the image tools the importer needs. This only happens once...
  python -m pip install --user pillow numpy
)

python tools\import_pages.py
echo.
pause
