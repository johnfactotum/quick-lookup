#!/bin/bash
install -D quick-lookup.js /usr/bin/quick-lookup
install com.github.johnfactotum.QuickLookup.desktop /usr/share/applications
install com.github.johnfactotum.QuickLookup.svg /usr/share/icons/hicolor/scalable/apps
install com.github.johnfactotum.QuickLookup-symbolic.svg /usr/share/icons/hicolor/symbolic/apps
gtk-update-icon-cache -qtf /usr/share/icons/hicolor
update-desktop-database -q /usr/share/applications
