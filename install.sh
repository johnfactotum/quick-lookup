#!/bin/bash
install -D quick-lookup.js /usr/bin/quick-lookup
install com.github.johnfactotum.QuickLookup.desktop /usr/share/applications
install com.github.johnfactotum.QuickLookup.svg /usr/share/icons/hicolor/scalable/apps
install com.github.johnfactotum.QuickLookup-symbolic.svg /usr/share/icons/hicolor/symbolic/apps
install com.github.johnfactotum.QuickLookup.gschema.xml /usr/share/glib-2.0/schemas
gtk-update-icon-cache -qtf /usr/share/icons/hicolor
update-desktop-database -q /usr/share/applications
glib-compile-schemas /usr/share/glib-2.0/schemas
