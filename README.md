# Quick Lookup

Quick Lookup is a simple GTK dictionary application powered by [Wiktionary](https://en.wiktionary.org/).

![Screenshot](screenshot.png)

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
```

To uninstall, run

```bash
sudo rm /usr/bin/quick-lookup
sudo rm /usr/share/applications/com.github.johnfactotum.QuickLookup.desktop
```

### Run without installing

```bash
gjs quick-lookup.js
```

### Flatpak

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

