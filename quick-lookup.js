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

imports.gi.versions.Gio = '2.0'
imports.gi.versions.Gtk = '4.0'
imports.gi.versions.WebKit2 = '5.0'
imports.gi.versions.Adw = '1'
const { GLib, Gio, Gtk, Gdk, WebKit2, Adw } = imports.gi
const System = imports.system

const pkg = {
    name: '@PACKAGE_NAME@',
    version: '@PACKAGE_VERSION@',
}
GLib.set_prgname(pkg.name)

let lookupSelection = false

let settings
try {
    settings = new Gio.Settings({ schema_id: pkg.name })
} catch(e) {}

const baseURL = 'https://en.wiktionary.org/'
const baseWikiRegExp = new RegExp('^https://en.wiktionary.org/wiki/')
const apiURL = 'https://en.wiktionary.org/api/rest_v1/page/definition/'

// see https://en.wiktionary.org/wiki/Wiktionary:Namespace
const wikiNamespaces = [
    'Media', 'Special', 'Talk', 'User', 'Wiktionary', 'File', 'MediaWiki',
    'Template', 'Help', 'Category',
    'Summary', 'Appendix', 'Concordance', 'Index', 'Rhymes', 'Transwiki',
    'Thesaurus', 'Citations', 'Sign',
]

// by no means a complete list; no particular order or criteria
const suggestedLangs = [
    'English', 'French', 'Spanish', 'Italian', 'Portuguese', 'Romanian',
    'German', 'Dutch', 'Finnish', 'Hungarian', 'Greek', 'Irish', 'Catalan',
    'Swedish', 'Danish', 'Norwegian Bokmål', 'Norwegian Nynorsk', 'Icelandic',
    'Russian', 'Polish', 'Czech', 'Serbo-Croatian', 'Bulgarian',
    'Armenian', 'Georgian', 'Albanian', 'Lithuanian', 'Welsh', 'Zulu',
    'Chinese', 'Japanese', 'Korean', 'Vietnamese', 'Thai', 'Tagalog',
    'Arabic', 'Persian', 'Turkish', 'Hindi', 'Urdu', 'Indonesian',
    'Latin', 'Ancient Greek', 'Sanskrit', 'Hebrew', 'Esperanto',
].sort()

const scriptRunner = webView => {
    const promises = new Map()
    const makePromise = token => new Promise((resolve, reject) => promises.set(token, {
        resolve: value => (resolve(value), promises.delete(token)),
        reject: value => (reject(value), promises.delete(token)),
    }))

    const handler = ({ token, ok, payload }) => {
        const promise = promises.get(token)
        if (ok) promise.resolve(payload)
        else promise.reject(payload)
    }
    const manager = webView.get_user_content_manager()
    manager.connect(`script-message-received::handler`, (_, result) => {
        try { handler(JSON.parse(result.get_js_value().to_string())) }
        catch (e) { log(e) }
    })
    const success = manager.register_script_message_handler('handler')
    if (!success) throw new Error('failed to register message handler')

    const exec = (func, params) => {
        const token = Math.random().toString()
        const paramsStr = typeof params === 'undefined' ? '' : JSON.stringify(params)
        const exp = paramsStr ? `JSON.parse(decodeURI("${encodeURI(paramsStr)}"))` : ''
        const script = `(async () => await ${func}(${exp}))()
            .then(x => globalThis.webkit.messageHandlers.handler.postMessage(
                JSON.stringify({ token: "${token}", ok: true, payload: x })))
            .catch(e => globalThis.webkit.messageHandlers.handler.postMessage(
                JSON.stringify({ token: "${token}", ok: false, payload: e.message })))`
        const promise = makePromise(token)
        webView.run_javascript(script, null, () => {})
        return promise
    }
    const eval = exp => new Promise((resolve, reject) =>
        webView.run_javascript(`JSON.stringify(${exp})`, null, (_, result) => {
            try {
                const jsResult = webView.run_javascript_finish(result)
                const str = jsResult.get_js_value().to_string()
                const value = str !== 'undefined' ? JSON.parse(str) : null
                resolve(value)
            } catch (e) {
                reject(e)
            }
        }))
    return { exec, eval }
}

const script = `(() => {
const usurp = p => {
    let last = p
    for (let i = p.childNodes.length - 1; i >= 0; i--) {
        let e = p.removeChild(p.childNodes[i])
        p.parentNode.insertBefore(e, last)
        last = e
    }
    p.parentNode.removeChild(p)
}
const pangoMarkupTags = ['a', 'b', 'big', 'i', 's', 'sub', 'sup', 'small', 'tt', 'u']
const toPangoMarkup = (html, baseURL = '') => {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    Array.from(doc.body.querySelectorAll('*')).forEach(el => {
        const nodeName = el.nodeName.toLowerCase()
        if (pangoMarkupTags.indexOf(nodeName) === -1) usurp(el)
        else Array.from(el.attributes).forEach(x => {
            if (x.name === 'href') {
                const href = el.getAttribute('href')
                el.setAttribute('href', new URL(href, baseURL))
            } else el.removeAttribute(x.name)
        })
        if (nodeName === 'a' && !el.hasAttribute('href')) usurp(el)
    })
    return doc.body.innerHTML.trim().replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&').replace(/&/g, '&amp;')
}

const baseURL = '${baseURL}'
const wiktionary = ({ word, language }) => fetch('${apiURL}' + word)
    .then(res => res.ok ? res.json() : Promise.reject(new Error()))
    .then(json => {
        const results = language.length === 2
            ? json[language]
            : Object.values(json).find(x => x[0].language === language)
                ?? json.other.filter(x => x.language === language)
        results.forEach(el => {
            el.definitions.forEach(x => {
                x.definition = toPangoMarkup(x.definition, baseURL)
                if (x.examples) x.examples = x.examples.map(ex =>
                    toPangoMarkup(ex, baseURL))
            })
        })
        return { word: decodeURIComponent(word), results }
    })
    .catch(e => {
        const lower = word.toLowerCase()
        if (lower !== word) return wiktionary({ word: lower, language })
        else throw new Error('no definitions found')
    })

globalThis.wiktionary = wiktionary
})()`

const webView = new WebKit2.WebView({
    settings: new WebKit2.Settings({
        enable_javascript_markup: false,
        enable_write_console_messages_to_stdout: true,
        allow_universal_access_from_file_urls: true,
        allow_file_access_from_file_urls: false,
        enable_fullscreen: false,
        enable_hyperlink_auditing: false,
    }),
})
const { eval, exec } = scriptRunner(webView)
const lookup = async (word, language) => {
    await eval(script)
    return await exec('wiktionary', { word, language })
}

const buildDefinition = handleLink => ({ definition, examples }, i) => {
    const label = new Gtk.Label({
        label: `${i + 1}`,
        valign: Gtk.Align.START,
        halign: Gtk.Align.END,
    })
    label.get_style_context().add_class('dim-label')

    const value = new Gtk.Label({
        label: definition,
        valign: Gtk.Align.START,
        halign: Gtk.Align.START,
        hexpand: true,
        xalign: 0,
        use_markup: true,
        selectable: true,
        wrap: true,
    })
    value.connect('activate-link', handleLink)

    if (examples) {
        const exampleBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 3,
            margin_start: 18,
            margin_top: 6,
            margin_bottom: 6,
        })
        examples.forEach(example => {
            const exampleLabel = new Gtk.Label({
                label: example,
                valign: Gtk.Align.START,
                halign: Gtk.Align.START,
                hexpand: true,
                xalign: 0,
                use_markup: true,
                selectable: true,
                wrap: true,
            })
            exampleLabel.connect('activate-link', handleLink)
            const ctx = exampleLabel.get_style_context()
            ctx.add_class('dim-label')
            ctx.add_class('caption')
            exampleBox.append(exampleLabel)
        })
        return [[label, value], [null, exampleBox]]
    } else return [[label, value]]
}

const buildPartsOfSpeech = handleLink => ({ partOfSpeech, definitions }, i) => {
    const partOfSpeechBox = new Gtk.Box({ spacing: 6 })
    const partOfSpeechLabel = new Gtk.Label({
        label: `<i>${partOfSpeech}</i>`,
        xalign: 0,
        use_markup: true,
    })
    partOfSpeechLabel.get_style_context().add_class('dim-label')
    partOfSpeechBox.append(partOfSpeechLabel)
    partOfSpeechBox.append(new Gtk.Separator({ valign: Gtk.Align.CENTER, hexpand: true }))

    return (i > 0 ? [[new Gtk.Label()]] : [])
        .concat([[new Gtk.Separator({ valign: Gtk.Align.CENTER }), partOfSpeechBox]])
        .concat(definitions.map(buildDefinition(handleLink)).flat())
}

const buildResultsPage = ({ word, results }, handleLink) => {
    const displayWord = word.replace(/_/g, ' ')
    const displayLanguage = results[0].language
    const linkLanguage = displayLanguage.replace(/ /g, '_')

    const grid = new Gtk.Grid({
        column_spacing: 6,
        row_spacing: 6,
        margin_start: 18,
        margin_end: 18,
        margin_top: 18,
        margin_bottom: 18,
    })
    const scroll = new Gtk.ScrolledWindow()
    scroll.set_child(grid)

    const langLabel = new Gtk.Label({
        label: displayLanguage,
        xalign: 0,
    })
    const ctx = langLabel.get_style_context()
    ctx.add_class('dim-label')
    ctx.add_class('caption')

    const title = new Gtk.Label({
        label: GLib.markup_escape_text(displayWord, -1),
        xalign: 0,
        use_markup: true,
        selectable: true,
        wrap: true,
    })
    title.get_style_context().add_class('title-1')

     const sourceLabel = new Gtk.Label({
        label: `<small>Source: <a href="${baseURL}wiki/${
            GLib.markup_escape_text(word, -1)
        }#${linkLanguage}">Wiktionary</a></small>`,
        xalign: 1,
        use_markup: true,
        margin_top: 18,
    })
    sourceLabel.get_style_context().add_class('dim-label')

    ;[[null, langLabel], [null, title]]
        .concat(results.map(buildPartsOfSpeech(handleLink)).flat())
        .concat([[null, sourceLabel]])
        .map(([a, b], i) => {
            if (a) grid.attach(a, 0, i, 1, 1)
            if (b) grid.attach(b, 1, i, 1, 1)
        })

    return scroll
}

const applicationWindowXml = `<?xml version="1.0" encoding="UTF-8"?><interface>
<object class="AdwApplicationWindow" id="application-window">
  <property name="default-height">540</property>
  <property name="default-width">480</property>
  <property name="title">Quick Lookup</property>
  <property name="content">
    <object class="GtkBox">
      <property name="orientation">vertical</property>
      <child>
        <object class="AdwHeaderBar">
          <property name="title-widget">
            <object class="GtkSearchEntry" id="query-entry">
              <property name="placeholder-text">Word or phrase</property>
              <property name="tooltip-text">Word or phrase to look up</property>
            </object>
          </property>
          <child type="start">
            <object class="GtkButton">
              <property name="icon-name">go-previous-symbolic</property>
              <property name="tooltip-text">Go back</property>
              <property name="action-name">win.go-back</property>
            </object>
          </child>
          <child type="end">
            <object class="GtkMenuButton" id="primary-menu-button">
              <property name="primary">true</property>
              <property name="icon-name">open-menu-symbolic</property>
              <property name="menu-model">primary-menu</property>
              <property name="tooltip-text">Main Menu</property>
            </object>
          </child>
        </object>
      </child>
      <child>
        <object class="GtkScrolledWindow">
          <property name="vexpand">true</property>
          <child>
            <object class="GtkStack" id="stack">
              <child>
                <object class="GtkStackPage">
                  <property name="name">init</property>
                  <property name="child">
                    <object class="AdwStatusPage">
                      <property name="icon-name">accessories-dictionary-symbolic</property>
                      <property name="description">“Language is a city to the building of which every human being brought a stone.”\n―Ralph Waldo Emerson</property>
                    </object>
                  </property>
                </object>
              </child>
              <child>
                <object class="GtkStackPage">
                  <property name="name">loading</property>
                  <property name="child">
                    <object class="GtkSpinner">
                      <property name="valign">center</property>
                      <property name="width-request">32</property>
                      <property name="height-request">32</property>
                      <property name="spinning">true</property>
                    </object>
                  </property>
                </object>
              </child>
              <child>
                <object class="GtkStackPage">
                  <property name="name">error</property>
                  <property name="child">
                    <object class="AdwStatusPage">
                      <property name="icon-name">face-uncertain-symbolic</property>
                      <property name="title">No definitions found</property>
                      <property name="description">“Impossible is a word to be found only in the dictionary of fools.”\n―Napoléon Bonaparte</property>
                    </object>
                  </property>
                </object>
              </child>
            </object>
          </child>
        </object>
      </child>
      <child>
        <object class="GtkActionBar">
          <child type="center">
            <object class="GtkComboBoxText" id="lang-combo">
              <property name="hexpand">true</property>
              <property name="has-entry">true</property>
              <property name="has-frame">false</property>
            </object>
          </child>
        </object>
      </child>
    </object>
  </property>
</object>
<menu id="primary-menu">
  <section>
    <item>
      <attribute name="label">_Keyboard Shortcuts</attribute>
      <attribute name="action">win.show-help-overlay</attribute>
    </item>
    <item>
      <attribute name="label">_About Quick Lookup</attribute>
      <attribute name="action">app.about</attribute>
    </item>
  </section>
</menu>
<object class="GtkShortcutsWindow" id="shortcuts-window">
    <property name="modal">True</property>
    <child>
      <object class="GtkShortcutsSection">
        <child>
          <object class="GtkShortcutsGroup">
            <child>
              <object class="GtkShortcutsShortcut">
                <property name="visible">True</property>
                <property name="title">Go back</property>
                <property name="action-name">win.go-back</property>
              </object>
            </child>
            <child>
              <object class="GtkShortcutsShortcut">
                <property name="visible">True</property>
                <property name="title">Focus on word entry</property>
                <property name="action-name">win.query-entry</property>
              </object>
            </child>
            <child>
              <object class="GtkShortcutsShortcut">
                <property name="visible">True</property>
                <property name="title">Focus on language entry</property>
                <property name="action-name">win.lang-entry</property>
              </object>
            </child>
            <child>
              <object class="GtkShortcutsShortcut">
                <property name="visible">True</property>
                <property name="title">Menu</property>
                <property name="action-name">win.menu</property>
              </object>
            </child>
            <child>
              <object class="GtkShortcutsShortcut">
                <property name="visible">True</property>
                <property name="title">Close</property>
                <property name="action-name">win.close</property>
              </object>
            </child>
            <child>
              <object class="GtkShortcutsShortcut">
                <property name="visible">True</property>
                <property name="title">Quit</property>
                <property name="action-name">app.quit</property>
              </object>
            </child>
          </object>
        </child>
      </object>
    </child>
</object>
</interface>`

const about = application => () => {
    const aboutWindow = new Adw.AboutWindow({
        application_icon: pkg.name,
        application_name: 'Quick Lookup',
        developer_name: 'John Factotum',
        issue_url: 'https://github.com/johnfactotum/quick-lookup/issues',
        license_type: Gtk.License.GPL_3_0,
        version: pkg.version,
        website: 'https://github.com/johnfactotum/quick-lookup',
        modal: true,
        transient_for: application.active_window
    })
    aboutWindow.present()
}

const addAction = window => {
    const { application } = window
    return ([fullName, accels, func]) => {
        const [scope, name] = fullName.split('.')
        const action = new Gio.SimpleAction({ name })
        action.connect('activate', func)
        if (scope === 'app') application.add_action(action)
        else window.add_action(action)
        application.set_accels_for_action(`${scope}.${name}`, accels)
    }
}

const makeApplicationWindow = application => {
    const builder = Gtk.Builder.new_from_string(applicationWindowXml, -1)
    const $ = builder.get_object.bind(builder)

    const win = $('application-window')
    win.application = application
    win.set_help_overlay($('shortcuts-window'))
    const menuButton = $('primary-menu-button')

    win.connect('notify::is-active', () => {
        if (!lookupSelection || !win.is_active) return
        const display = Gdk.Display.get_default()
        const clipboard = display.get_primary_clipboard()
        clipboard.read_text_async(null, (_, res) => {
            try {
                const text = clipboard.read_text_finish(res).trim()
                if (text && text !== queryEntry.text) {
                    queryEntry.text = text
                    queryEntry.grab_focus()
                    queryEntry.set_position(-1)
                    onActivate()
                }
            } catch (e) {}
        })
    })

    const queryEntry = $('query-entry')
    const langCombo = $('lang-combo')
    suggestedLangs.forEach(lang => langCombo.append_text(lang))
    const langEntry = langCombo.get_child()
    langEntry.placeholder_text = 'Language'
    langEntry.tooltip_text = 'Language name or ISO 639-1 code'
    langEntry.set_icon_from_icon_name(Gtk.EntryIconPosition.PRIMARY,
        'preferences-desktop-locale-symbolic')
    const completion = new Gtk.EntryCompletion()
    completion.set_text_column(0)
    completion.set_model(langCombo.get_model())
    langEntry.set_completion(completion)
    langEntry.text = 'English'
    if (settings) {
        const flag = Gio.SettingsBindFlags.DEFAULT
        settings.bind('language', langEntry, 'text', flag)
    }

    let currentPage
    const history = []
    const goBack = () => {
        if (!history.length) return
        doLookup(...history.pop(), false)
        if (!history.length) win.lookup_action('go-back').enabled = false
    }
    const pushHistory = () => {
        if (!currentPage) return
        history.push(currentPage)
        win.lookup_action('go-back').enabled = true
    }

    const stack = $('stack')
    const doLookup = async (word, language, record = true) => {
        if (record) pushHistory()
        stack.visible_child_name = 'loading'
        const oldResults = stack.get_child_by_name('results')
        if (oldResults) stack.remove(oldResults)
        try {
            const results = await lookup(word, language || 'en')
            const widget = buildResultsPage(results, (_, uri) => {
                queryEntry.grab_focus()
                const internalLink = uri.split(baseWikiRegExp)[1]
                if (internalLink && wikiNamespaces.every(namespace =>
                    !internalLink.startsWith(namespace + ':')
                    && !internalLink.startsWith(namespace + '_talk:'))) {
                    const [title, lang] = internalLink.split('#')
                    const word = decodeURIComponent(title).replace(/_/g, ' ')
                    doLookup(word, lang).catch(e => log(e))
                    return true
                }
            })
            currentPage = [word, language]
            stack.add_named(widget, 'results')
            stack.visible_child_name = 'results'
        } catch (e) {
            log(e)
            stack.visible_child_name = 'error'
        }
    }
    const onActivate = () => doLookup(queryEntry.text, langEntry.text)
    langEntry.connect('activate', onActivate)
    queryEntry.connect('activate', onActivate)

    ;[
        ['win.go-back', ['<Alt>Left'], goBack],
        ['win.close', ['<Control>w'], () => win.close()],
        ['win.query-entry', ['<Control>f', 'F6'], () => queryEntry.grab_focus()],
        ['win.lang-entry', ['<Control>l'], () => langCombo.grab_focus()],
        ['app.quit', ['<Control>q'], () => application.quit()],
        ['app.about', [], about(application)],
    ].map(addAction(win))
    application.set_accels_for_action('win.show-help-overlay', ['<ctrl>question'])
    win.lookup_action('go-back').enabled = false

    return win
}

const app = new Adw.Application({
    application_id: pkg.name,
    flags: Gio.ApplicationFlags.FLAGS_NONE,
})

app.connect('activate', app =>
    (app.activeWindow ?? makeApplicationWindow(app)).present())

app.add_main_option('version',
    'v'.charCodeAt(0), GLib.OptionFlags.NONE, GLib.OptionArg.NONE,
    'Show version', null)

app.add_main_option('selection',
    0, GLib.OptionFlags.NONE, GLib.OptionArg.NONE,
    'Look up primary selection text', null)

app.connect('handle-local-options', (app, options) => {
    if (options.contains('version')) {
        print(pkg.version)
        return 0
    }
    if (options.contains('selection')) lookupSelection = true
    return -1
})

// see https://stackoverflow.com/a/35237684
ARGV.unshift(System.programInvocationName)
app.run(ARGV)
