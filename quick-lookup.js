#!/usr/bin/gjs
/*
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

imports.gi.versions.Gtk = '3.0'
const { GLib, Gio, Gtk } = imports.gi
const Webkit = imports.gi.WebKit2

const isExternalURL = href =>
    href.indexOf("mailto:") === 0 || href.indexOf("://") > -1

const baseURL = 'https://en.wiktionary.org/'

const lookupHtml = `<script>
const dispatch = action => {
    const obj = { time: new Date().getTime(), ...action }
    window.webkit.messageHandlers.action.postMessage(JSON.stringify(obj))
}

// from https://stackoverflow.com/a/11892228
const usurp = p => {
    let last = p
    for (let i = p.childNodes.length - 1; i >= 0; i--) {
        let e = p.removeChild(p.childNodes[i])
        p.parentNode.insertBefore(e, last)
        last = e
    }
    p.parentNode.removeChild(p)
}

// see https://en.wiktionary.org/wiki/Wiktionary:Namespace
const wiktionaryNamespaces = [
    'Media',
    'Special',
    'Talk',
    'User',
    'Wiktionary',
    'File',
    'MediaWiki',
    'Template',
    'Help',
    'Category',
    'Summary',
    'Appendix',
    'Concordance',
    'Index',
    'Rhymes',
    'Transwiki',
    'Thesaurus',
    'Citations',
    'Sign'
]
const pangoMarkupTags =
    ['a', 'b', 'big', 'i', 's', 'sub', 'sup', 'small', 'tt', 'u']
const toPangoMarkup = (html, baseURL = '') => {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    Array.from(doc.body.querySelectorAll('*')).forEach(el => {
        const nodeName = el.nodeName.toLowerCase()
        if (pangoMarkupTags.indexOf(nodeName) === -1) usurp(el)
        else Array.from(el.attributes).forEach(x => {
            if (x.name === 'href') {
                const href = el.getAttribute('href')
                if (!href.startsWith('/wiki/')
                    || wiktionaryNamespaces.some(namespace =>
                        href.startsWith('/wiki/' + namespace + ':')
                        || href.startsWith('/wiki/' + namespace + '_talk:')))
                    el.setAttribute('href', new URL(href, baseURL))
            } else el.removeAttribute(x.name)
        })
        if (nodeName === 'a' && !el.hasAttribute('href')) usurp(el)
    })
    return doc.body.innerHTML.trim().replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&').replace(/&/g, '&amp;')
}

const baseURL = '${baseURL}'
const wiktionary = (word, language = 'en') =>
    fetch('https://en.wiktionary.org/api/rest_v1/page/definition/' + word)
        .then(res => {
            if (res.ok) return res
            else throw new Error()
        })
        .then(res => res.json())
        .then(json => {
            const results = language.length === 2
                ? json[language]
                : Object.values(json).find(x => x[0].language === language)
            
            results.forEach(el => {
                el.definitions.forEach(x => {
                    x.definition = toPangoMarkup(x.definition, baseURL)
                    if (x.examples)
                        x.examples = x.examples.map(ex =>
                            toPangoMarkup(ex, baseURL))
                })
            })
            return { word: decodeURIComponent(word), results }
        })
        .then(payload => dispatch({ type: 'lookup-results', payload }))
        .catch(e => {
            console.error(e)
            word = decodeURI(word)
            const lower = word.toLowerCase()
            if (lower !== word)
                dispatch({ type: 'lookup-again', payload: lower })
            else dispatch({ type: 'lookup-error' })
        })

dispatch({ type: 'can-lookup' })
</script>
`

const lookup = (script, againScript) => new Promise((resolve, reject) => {
    const webView = new Webkit.WebView({
        settings: new Webkit.Settings({
            enable_write_console_messages_to_stdout: true,
            allow_universal_access_from_file_urls: true
        })
    })
    const scriptRun = script => webView.run_javascript(script, null, () => {})

    webView.load_html(lookupHtml, null)

    const contentManager = webView.get_user_content_manager()
    contentManager.connect('script-message-received::action', (_, message) => {
        const data = message.get_js_value().to_string()
        const { type, payload } = JSON.parse(data)
        switch (type) {
            case 'can-lookup':
                scriptRun(script)
                break
            case 'lookup-again':
                scriptRun(againScript(payload))
                break
            case 'lookup-results':
                resolve(payload)
                break
            case 'lookup-error':
                reject()
                break
        }
    })
    contentManager.register_script_message_handler('action')
})

const wiktionary = (word, language) =>
    lookup(`wiktionary("${encodeURIComponent(word)}", '${language}')`,
        payload => `wiktionary("${encodeURIComponent(payload)}", '${language}')`)

class AppWindow {
    constructor(app) {
        this._app = app
        this._history = []
        this._currentPage = null
    }
    _addShortcut(accels, name, func) {
        const action = new Gio.SimpleAction({ name })
        action.connect('activate', func)
        this._window.add_action(action)
        this._app.set_accels_for_action(`win.${name}`, accels)
    }
    _goBack() {
        if (!this._history.length) return
        this._lookup(...this._history.pop())
        if (!this._history.length) this._backButton.sensitive = false
    }
    _pushHistory(x) {
        this._history.push(x)
        this._backButton.sensitive = true
    }
    _buildUI() {
        const window = new Gtk.ApplicationWindow({
            application: this._app,
            defaultHeight: 450,
            defaultWidth: 500,
        })
        const headerBar = new Gtk.HeaderBar({ show_close_button: true })
        window.set_titlebar(headerBar)
        window.title = 'Quick Lookup'

        const queryEntry = new Gtk.SearchEntry({
            placeholder_text: 'Word or phrase',
            tooltip_text: 'Word or phrase to look up'
        })
        const langEntry = new Gtk.Entry({
            placeholder_text: 'Language',
            tooltip_text: 'Enter language name or ISO 639-1 code',
            width_chars: 10
        })
        langEntry.set_icon_from_icon_name(Gtk.EntryIconPosition.PRIMARY,
            'preferences-desktop-locale-symbolic')
        langEntry.set_icon_sensitive(Gtk.EntryIconPosition.PRIMARY, false)
        const lookup = () => {
            if (this._currentPage) this._pushHistory(this._currentPage)
            this._lookup(this._queryEntry.text, this._langEntry.text)
        }
        langEntry.connect('activate', lookup)
        queryEntry.connect('activate', lookup)

        this._backButton = new Gtk.Button({
            image: new Gtk.Image({ icon_name: 'go-previous-symbolic' }),
            tooltip_text: 'Go back',
            sensitive: false,
            visible: true
        })
        this._backButton.connect('clicked', () => this._goBack())
        headerBar.pack_start(this._backButton)

        const box = new Gtk.Box({ spacing: 6 })
        box.pack_start(langEntry, false, true, 0)
        box.pack_start(queryEntry, true, true, 0)
        headerBar.custom_title = box

        const content = new Gtk.Box({
            valign: Gtk.Align.CENTER,
            halign: Gtk.Align.CENTER,
            spacing: 18,
            border_width: 18,
            orientation: Gtk.Orientation.VERTICAL
        })
        const image = new Gtk.Image({
            icon_name: 'accessories-dictionary-symbolic', pixel_size: 64
        })
        image.get_style_context().add_class('dim-label')
        const label =  new Gtk.Label({
            label: '“ Language is a city to the building of which every human being brought a stone.”―Ralph Waldo Emerson',
            max_width_chars: 50
        })
        label.set_line_wrap(true)
        label.get_style_context().add_class('dim-label')
        content.pack_start(image, false, true, 0)
        content.pack_start(label, false, true, 0)
        this._content = content
        window.add(this._content)

        window.show_all()

        this._window = window
        this._queryEntry = queryEntry
        this._langEntry = langEntry

        this._addShortcut(['<Control>w', '<Control>q'],
            'close', () => this._window.close())
        this._addShortcut(['<Alt>Left'],
            'go-back', () => this._goBack())
        this._addShortcut(['<Control>f', 'F6'],
            'query-entry', () => this._queryEntry.grab_focus())
        this._addShortcut(['<Control>l'],
            'lang-entry', () => this._langEntry.grab_focus())
    }
    _lookup(query, language) {
        this._currentPage = [query, language]

        const box = new Gtk.Box({ border_width: 18 })
        const spinner = new Gtk.Spinner({
            width_request: 48,
            height_request: 48
        })
        spinner.start()
        box.pack_start(spinner, true, true, 0)

        this._window.remove(this._content)
        this._content = box
        this._window.add(this._content)
        this._content.show_all()
    
        const handleLink = (_, uri) => {
            const internalLink = uri.split(/^\/wiki\//)[1]
            if (internalLink) {
                this._pushHistory([query, language])
                const [title, lang] = internalLink.split('#')
                const word = decodeURIComponent(title)
                    .replace(/_/g, ' ')
                this._lookup(word, lang || 'en')
                return true
            }
        }

        wiktionary(query, language).then(({ word, results }) => {
            const grid = new Gtk.Grid({
                column_spacing: 6, row_spacing: 6,
                border_width: 18,
                valign: Gtk.Align.START
            })
            let row = 0
            results.forEach(({ partOfSpeech, definitions, language }, i) => {
                if (i === 0) {
                    const langLabel = new Gtk.Label({
                        label: `<small>${language}</small>`,
                        xalign: 0,
                        use_markup: true,
                        selectable: true
                    })
                    langLabel.get_style_context().add_class('dim-label')
                    grid.attach(langLabel, 1, row, 1, 1)
                    row++
                    
                    const title = new Gtk.Label({
                        label: '<span size="x-large" weight="bold">'
                            + GLib.markup_escape_text(word.replace(/_/g, ' '), -1)
                            + '</span>',
                        xalign: 0,
                        use_markup: true,
                        selectable: true
                    })
                    grid.attach(title, 1, row, 1, 1)
                    title.set_line_wrap(true)
                    row++
                } else {
                    grid.attach(new Gtk.Label(), 1, row, 1, 1)
                    row++
                }
                
                const posBox = new Gtk.Box({ spacing: 6 })
                const posLabel = new Gtk.Label({
                    label: `<i>${partOfSpeech}</i>`,
                    xalign: 0,
                    use_markup: true,
                    selectable: true
                })
                posLabel.get_style_context().add_class('dim-label')
                posBox.pack_start(posLabel, false, true, 0)
                posBox.pack_start(new Gtk.Separator({
                    valign: Gtk.Align.CENTER
                }), true, true, 0)
                grid.attach(new Gtk.Separator({
                    valign: Gtk.Align.CENTER
                }), 0, row, 1, 1)
                grid.attach(posBox, 1, row, 1, 1)
                row++
                
                definitions.forEach(({ definition, examples }, i) => {
                    const label = new Gtk.Label({
                        label: i + 1 + '.',
                        valign: Gtk.Align.START,
                        halign: Gtk.Align.END,
                        selectable: true
                    })
                    label.get_style_context().add_class('dim-label')
                    grid.attach(label, 0, row, 1, 1)

                    const value = new Gtk.Label({
                        label: definition,
                        valign: Gtk.Align.START,
                        halign: Gtk.Align.START,
                        hexpand: true,
                        xalign: 0,
                        use_markup: true,
                        selectable: true
                    })
                    value.set_line_wrap(true)
                    value.connect('activate-link', handleLink)
                    grid.attach(value, 1, row, 1, 1)
                    row++
                    
                    if (examples) {
                        const exampleBox = new Gtk.Box({
                            orientation: Gtk.Orientation.VERTICAL,
                            spacing: 3,
                            margin_start: 18,
                            margin_top: 6,
                            margin_bottom: 6
                        })
                        examples.forEach(example => {
                            const exampleLabel = new Gtk.Label({
                                label: `<small>${
                                    example
                                }</small>`,
                                valign: Gtk.Align.START,
                                halign: Gtk.Align.START,
                                hexpand: true,
                                xalign: 0,
                                use_markup: true,
                                selectable: true
                            })
                            exampleLabel.set_line_wrap(true)
                            exampleLabel.connect('activate-link', handleLink)
                            exampleLabel.get_style_context()
                                .add_class('dim-label')
                            exampleBox.pack_start(exampleLabel, false, true, 0)
                        })
                        grid.attach(exampleBox, 1, row, 1, 1)
                        row++
                    }
                })
            })

            const sourceLabel = new Gtk.Label({
                label: `<small>Source: <a href="${baseURL}wiki/${
                    GLib.markup_escape_text(word, -1)
                }#${results[0].language}">Wiktionary</a></small>`,
                xalign: 1,
                use_markup: true
            })
            sourceLabel.get_style_context().add_class('dim-label')
            const sourceBox = new Gtk.Box({ border_width: 18 })
            sourceBox.pack_end(sourceLabel, false, true, 0)

            const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
            box.pack_start(grid, true, true, 0)
            box.pack_end(sourceBox, false, true, 0)

            const scroll = new Gtk.ScrolledWindow()
            scroll.add(box)

            this._window.remove(this._content)
            this._content = scroll
            this._window.add(this._content)
            this._content.show_all()
        }).catch(e => {
            print(e)
            const box = new Gtk.Box({
                valign: Gtk.Align.CENTER,
                halign: Gtk.Align.CENTER,
                spacing: 18,
                border_width: 18,
                orientation: Gtk.Orientation.VERTICAL
            })
            const title =  new Gtk.Label({
                label: '<span size="x-large" weight="bold">No definitions found</span>',
                use_markup: true
            })
            title.get_style_context().add_class('dim-label')
            const label =  new Gtk.Label({
                label: '“ Impossible is a word to be found only in the dictionary of fools.”―Napoléon Bonaparte',
                max_width_chars: 50
            })
            label.set_line_wrap(true)
            label.get_style_context().add_class('dim-label')
            const image = new Gtk.Image({
                icon_name: 'face-uncertain-symbolic', pixel_size: 64
            })
            image.get_style_context().add_class('dim-label')
            box.pack_start(image, false, true, 0)
            box.pack_start(title, false, true, 0)
            box.pack_start(label, false, true, 0)

            this._window.remove(this._content)
            this._content = box
            this._window.add(this._content)
            this._content.show_all()
        })
    }
    getWidget() {
        this._buildUI()
        return this._window
    }
}

const application = new Gtk.Application({
    application_id: 'com.github.johnfactotum.QuickLookup',
    flags: Gio.ApplicationFlags.FLAGS_NONE
})

application.connect('activate', app => {
    const activeWindow = app.activeWindow || new AppWindow(app).getWidget()
    activeWindow.present()
})

application.run(null)
