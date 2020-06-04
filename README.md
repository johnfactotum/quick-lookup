<img src="com.github.johnfactotum.QuickLookup.svg" align="left">

# Quick Lookup

Quick Lookup is a simple GTK dictionary application powered by [Wiktionary](https://en.wiktionary.org/)™.

<img src="screenshot.png" alt="Screenshot" width="552">

## Features

- Lookup definitions for words or phrases using the [Wikimedia REST API of Wiktionary](https://en.wiktionary.org/api/rest_v1/#/Page%20content/get_page_definition__term_)
- Choose language by entering language name or ISO-639-1 code (e.g., "English" or "en")
- Open internal links within the app
- Go back to previous page with the back button

## Installation

Dependencies:

- `gjs (>= 1.52)`
- `webkit2gtk`

To install, run

```bash
sudo install -D quick-lookup.js /usr/bin/quick-lookup
sudo install com.github.johnfactotum.QuickLookup.desktop /usr/share/applications
sudo install com.github.johnfactotum.QuickLookup.svg /usr/share/icons/hicolor/scalable/apps
sudo install com.github.johnfactotum.QuickLookup-symbolic.svg /usr/share/icons/hicolor/symbolic/apps
sudo gtk-update-icon-cache -qtf /usr/share/icons/hicolor
sudo update-desktop-database -q /usr/share/applications
```

To uninstall, run

```bash
sudo rm /usr/bin/quick-lookup
sudo rm /usr/share/applications/com.github.johnfactotum.QuickLookup.desktop
sudo rm /usr/share/icons/hicolor/scalable/apps/com.github.johnfactotum.QuickLookup.svg
sudo rm /usr/share/icons/hicolor/symbolic/apps/com.github.johnfactotum.QuickLookup-symbolic.svg
```

### Run without installing

```bash
gjs quick-lookup.js
```

### Flatpak

<a href="https://flathub.org/apps/details/com.github.johnfactotum.QuickLookup"><img height="50" alt="Download on Flathub" src="https://flathub.org/assets/badges/flathub-badge-en.png"></a>

#### Building Flatpaks manually

##### Using Gnome Builder
Open [Gnome Builder](https://wiki.gnome.org/Apps/Builder), choose "Clone Repository…", and follow the instructions. After cloning the project, hit Ctrl+F5 to build and run.

##### Using `flatpak-builder`

```bash
flatpak-builder --force-clean --install --user build com.github.johnfactotum.QuickLookup.json
```

## FAQ

### Why does it only support English Wiktionary?

The Wiktionary API is only available for English. Explanation from [MediaWiki](https://www.mediawiki.org/wiki/Wikimedia_Apps/Wiktionary_definition_popups_in_the_Android_Wikipedia_app):

> Wiktionary content is unstructured, and presenting a concise set of definitions requires parsing them from the page HTML. English Wiktionary has an entry layout guide which assisted in this for the current English-only implementation. 

### Why is WebKit a dependency?

Because I'm lazy and I used the DOM APIs provided by WebKit to manipulate HTML markups.

### Will you add support for other online/offline dictionaries?

Probably not, because I'm lazy.

---

Wiktionary is a trademark of the Wikimedia Foundation. This program is not endorsed by or affiliated with the Wikimedia Foundation.
