#!/bin/bash
rm /usr/bin/quick-lookup
rm /usr/share/applications/com.github.johnfactotum.QuickLookup.desktop
rm /usr/share/icons/hicolor/scalable/apps/com.github.johnfactotum.QuickLookup.svg
rm /usr/share/icons/hicolor/symbolic/apps/com.github.johnfactotum.QuickLookup-symbolic.svg
rm /usr/share/glib-2.0/schemas/com.github.johnfactotum.QuickLookup.gschema.xml
gtk-update-icon-cache -qtf /usr/share/icons/hicolor
update-desktop-database -q /usr/share/applications
glib-compile-schemas /usr/share/glib-2.0/schemas
