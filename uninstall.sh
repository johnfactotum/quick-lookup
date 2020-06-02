#!/bin/bash
rm /usr/bin/quick-lookup
rm /usr/share/applications/com.github.johnfactotum.QuickLookup.desktop
rm /usr/share/icons/hicolor/scalable/apps/com.github.johnfactotum.QuickLookup.svg
rm /usr/share/icons/hicolor/symbolic/apps/com.github.johnfactotum.QuickLookup-symbolic.svg
gtk-update-icon-cache -qtf /usr/share/icons/hicolor
update-desktop-database -q /usr/share/applications
