project('com.github.johnfactotum.QuickLookup',
    version: '2.0.0',
    meson_version: '>=0.49'
)

prefix = get_option('prefix')
bindir = prefix / get_option('bindir')
datadir = prefix / get_option('datadir')

desktopdir = datadir / 'applications'
iconsdir = datadir / 'icons'
metainfodir = datadir / 'metainfo'
schemadir = datadir / 'glib-2.0' / 'schemas'

glib2_dep = dependency('glib-2.0')
gio2_dep = dependency('gio-2.0')
gjs_dep = dependency('gjs-1.0', version: '>=1.70')
gtk4_dep = dependency('gtk4')
webkit_dep = dependency('webkit2gtk-5.0')
libadwaita_dep = dependency('libadwaita-1')

bin_conf = configuration_data()
bin_conf.set('PACKAGE_VERSION', meson.project_version())
bin_conf.set('PACKAGE_NAME', meson.project_name())

configure_file(
    configuration: bin_conf,
    input: 'quick-lookup.js',
    install_dir: bindir,
    install_mode: 'rwxr-xr-x',
    output: 'quick-lookup'
)

install_data('com.github.johnfactotum.QuickLookup.desktop',
    install_dir: desktopdir
)

install_data('com.github.johnfactotum.QuickLookup.appdata.xml',
    install_dir: metainfodir
)

install_data('com.github.johnfactotum.QuickLookup.svg',
    install_dir: iconsdir / 'hicolor' / 'scalable' / 'apps'
)

install_data('com.github.johnfactotum.QuickLookup-symbolic.svg',
    install_dir: iconsdir / 'hicolor' / 'symbolic' / 'apps'
)

install_data('com.github.johnfactotum.QuickLookup.gschema.xml',
    install_dir: schemadir
)

meson.add_install_script('post_install.py')
