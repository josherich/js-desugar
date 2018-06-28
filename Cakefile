fs                        = require 'fs'
os                        = require 'os'
path                      = require 'path'
_                         = require 'underscore'
{ spawn, exec, execSync } = require 'child_process'
CoffeeScript              = require 'coffeescript'
desugar                   = require './app'

require 'coffeescript/register'

majorVersion = parseInt desugar.VERSION.split('.')[0], 10

# ANSI Terminal Colors.
bold = red = green = yellow = reset = ''
unless process.env.NODE_DISABLE_COLORS
  bold   = '\x1B[0;1m'
  red    = '\x1B[0;31m'
  green  = '\x1B[0;32m'
  yellow = '\x1B[0;33m'
  reset  = '\x1B[0m'
  
# Log a message with a color.
log = (message, color, explanation) ->
  console.log color + message + reset + ' ' + (explanation or '')


task 'doc:site', 'build the documentation for the website', ->
  buildDocs()

task 'doc:site:watch', 'watch and continually rebuild the documentation for the website', ->
  buildDocs yes

buildDocs = (watch = no) ->
  # Constants
  indexFile            = './site/index.html'
  siteSourceFolder     = "./site"
  sectionsSourceFolder = './sections'
  examplesSourceFolder = './examples'
  outputFolder         = "docs/v#{majorVersion}"

  # Helpers
  releaseHeader = (date, version, prevVersion) ->
    """
      <h3>#{prevVersion and "<a href=\"https://github.com/jashkenas/coffeescript/compare/#{prevVersion}...#{version}\">#{version}</a>" or version}
        <span class="timestamp"> &mdash; <time datetime="#{date}">#{date}</time></span>
      </h3>
    """

  codeFor = require "./site/code.coffee"


  htmlFor = ->
    hljs = require 'highlight.js'
    hljs.configure classPrefix: ''
    markdownRenderer = require('markdown-it')
      html: yes
      typographer: yes
      highlight: (str, lang) ->
        # From https://github.com/markdown-it/markdown-it#syntax-highlighting
        if lang and hljs.getLanguage(lang)
          try
            return hljs.highlight(lang, str).value
          catch ex
        return '' # No syntax highlighting


    # Add some custom overrides to Markdown-It’s rendering, per
    # https://github.com/markdown-it/markdown-it/blob/master/docs/architecture.md#renderer
    defaultFence = markdownRenderer.renderer.rules.fence
    markdownRenderer.renderer.rules.fence = (tokens, idx, options, env, slf) ->
      code = tokens[idx].content
      if code.indexOf('codeFor(') is 0 or code.indexOf('releaseHeader(') is 0
        "<%= #{code} %>"
      else
        "<blockquote class=\"uneditable-code-block\">#{defaultFence.apply @, arguments}</blockquote>"

    (file, bookmark) ->
      md = fs.readFileSync "#{sectionsSourceFolder}/#{file.replace /\//g, path.sep}.md", 'utf-8'
      md = md.replace /<%= releaseHeader %>/g, releaseHeader
      md = md.replace /<%= majorVersion %>/g, majorVersion
      md = md.replace /<%= fullVersion %>/g, desugar.VERSION
      html = markdownRenderer.render md
      html = _.template(html)
        codeFor: codeFor()
        releaseHeader: releaseHeader

  includeScript = ->
    (file) ->
      file = "#{siteSourceFolder}/#{file}" unless '/' in file
      code = fs.readFileSync file, 'utf-8'
      code = CoffeeScript.compile code
      # code = transpile code
      code

  include = ->
    (file) ->
      file = "#{siteSourceFolder}/#{file}" unless '/' in file
      output = fs.readFileSync file, 'utf-8'
      if /\.html$/.test(file)
        render = _.template output
        output = render
          releaseHeader: releaseHeader
          majorVersion: majorVersion
          fullVersion: desugar.VERSION
          htmlFor: htmlFor()
          codeFor: codeFor()
          include: include()
          includeScript: includeScript()
      output

  # Task
  do renderIndex = ->
    render = _.template fs.readFileSync(indexFile, 'utf-8')
    output = render
      include: include()
    fs.writeFileSync "#{outputFolder}/index.html", output
    log 'compiled', green, "#{indexFile} → #{outputFolder}/index.html"
  try
    fs.symlinkSync "v#{majorVersion}/index.html", 'docs/index.html'
  catch exception

  if watch
    for target in [indexFile, siteSourceFolder, examplesSourceFolder, sectionsSourceFolder]
      fs.watch target, interval: 200, renderIndex
    log 'watching...', green
