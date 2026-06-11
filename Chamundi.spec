# -*- mode: python ; coding: utf-8 -*-


from PyInstaller.utils.hooks import collect_all

rl_datas, rl_binaries, rl_hidden = collect_all('reportlab')
html_datas, html_binaries, html_hidden = collect_all('xhtml2pdf')

a = Analysis(
    ['backend\\main.py'],
    pathex=[],
    binaries=rl_binaries + html_binaries,
    datas=[('dist', 'dist'), ('backend/templates', 'templates')] + rl_datas + html_datas,
    hiddenimports=rl_hidden + html_hidden,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='ChamundiAccounting',
    icon='src/assets/icon.ico',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
