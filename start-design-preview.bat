@echo off
rem Design previews use a separate port so the coloring app's offline helper cannot intercept them.
cd /d "%~dp0"
echo Design preview: http://localhost:8001/tools/design.tmp/compact-workspace.html
echo Leave this window open while reviewing the layout.
python serve.py --port 8001 --design-preview
pause
