/* globals sidebarNodes */

// Search
// ======

// Dependencies
// ------------

import $ from 'jquery'
import lunr from 'lunr'
import * as helpers from './helpers'

import resultsTemplate from './templates/search-results.handlebars'

// Local Variables
// ---------------

const $content = $('.content-inner')
const $input = $('.sidebar-search input')

// Local Methods
// -------------

function highlight (match) {
  var start = match.index
  var end = match.index + match[0].length
  var input = match.input
  var highlighted = '<em>' + match[0] + '</em>'

  return input.slice(0, start) + highlighted + input.slice(end)
}

function cleaner (element) {
  return !!element
}

function findNested (elements, parentId, matcher) {
  return (elements || []).map(function (element) {
    // Match things like module.func
    var parentMatch = (parentId + '.' + element.id).match(matcher)
    var match = element.id && element.id.match(matcher)

    if (parentMatch || match) {
      var result = JSON.parse(JSON.stringify(element))
      result.match = match ? highlight(match) : element.id
      return result
    }
  }).filter(cleaner)
}

export function findIn (elements, matcher) {
  return elements.map(function (element) {
    var id = element.id
    var idMatch = id && id.match(matcher)
    var functionMatches = findNested(element.functions, id, matcher)
    var macroMatches = findNested(element.macros, id, matcher)
    var callbackMatches = findNested(element.callbacks, id, matcher)

    var result = {
      id: element.id,
      match: idMatch ? highlight(idMatch) : element.id
    }

    if (functionMatches.length > 0) result.functions = functionMatches
    if (macroMatches.length > 0) result.macros = macroMatches
    if (callbackMatches.length > 0) result.callbacks = callbackMatches

    if (idMatch ||
        functionMatches.length > 0 ||
        macroMatches.length > 0 ||
        callbackMatches.length > 0
       ) {
      return result
    }
  }).filter(cleaner)
}

function ngram(len) {
  return function(obj) {
    if (!arguments.length || obj == null || obj == undefined) return []
    if (Array.isArray(obj)) return obj.map(function (t) { return t.toLowerCase() })

    var str = "\u0002" + obj.toString() + '\u0003';

    if (str.length <= len) {
      return [str.toLowerCase()];
    } else {
      var buffer = [];
      for (var i = 0; i <= str.length - len; i++) {
        buffer.push(str.slice(i, i + len).toLowerCase());
      }
      return buffer;
    }
  }
}

function index(elements) {
  lunr.tokenizer = ngram(3)
  var idx = lunr(function () {
    this.field('title')
    this.field('anchor')
    this.tokenizer = ngram(3)
  })

  $.each(elements, function(x) {
    var functions = x.functions || []
    var macros = x.macros || []
    var callbacks = x.callbacks || []

    $.each(functions, function(y) {
      idx.add(y)
    })
    $.each(macros, function(y) {
      idx.add(y)
    })
    $.each(callbacks, function(y) {
      idx.add(y)
    })
  })

  return idx
}

function resultsFindIn(elements, ids) {
  var results = []

  elements.forEach(function(x) {
    var functions = x.functions || []
    var macros = x.macros || []
    var callbacks = x.callbacks || []

    var things = functions.filter(function(y) {
      $.inArray(y.id, ids)
    })

    results = results.concat(things)

  })

  return results
}

function search (nodes, value) {
  var safeVal = new RegExp(helpers.escapeText(value), 'i')

  var levels = []
  var names = []
  $.each(nodes.modules, function(index, x)
      { names.push({"title": x.id, "id": index, "_id": x.index}) }
  )
  var modules_idx = index(nodes.modules)
  var exceptions_idx = index(nodes.exceptions)
  var protocols_idx = index(nodes.protocols)

  var modules_results = modules_idx.search(value).map(function(x) { return x.ref })
  var exceptions_results = exceptions_idx.search(value).map(function(x) { return x.ref })
  var protocols_results = protocols_idx.search(value).map(function(x) { return x.ref })

  var no = resultsFindIn(nodes.modules, modules_results)
  var yes = resultsFindIn(nodes.exceptions, exceptions_results)
  var wow = resultsFindIn(nodes.protocols, protocols_results)

  // var modules = results.map(function(x) {
  //   var element = nodes.modules[parseInt(x.ref)]

  //   return {
  //     id: element.id,
  //     match: idMatch ? highlight(idMatch) : element.id
  //   }
  // })

  var modules = findIn(nodes.modules, safeVal)
  var exceptions = findIn(nodes.exceptions, safeVal)
  var protocols = findIn(nodes.protocols, safeVal)

  if (modules.length > 0) {
    levels.push({
      name: 'Modules',
      results: modules
    })
  }

  if (exceptions.length > 0) {
    levels.push({
      name: 'Exceptions',
      results: exceptions
    })
  }

  if (protocols.length > 0) {
    levels.push({
      name: 'Protocols',
      results: protocols
    })
  }

  var $results = $(resultsTemplate({
    value: value,
    levels: levels,
    empty: levels.length === 0
  }))

  var $oldContent = $content.find('*')
  $oldContent.hide()
  $content.append($results)

  function closeResults (e) {
    var event = e || window.event
    if (typeof event === 'object' && event !== null) {
      if (event.metaKey || event.shiftKey || event.altKey ||
          event.ctrlKey || event.button === 1 || event.button === 2) {
        return
      }
    }

    $results.remove()
    $oldContent.fadeIn()
  }

  $results.find('.close-search').on('click', function (e) {
    e.preventDefault()
  })

  $results.find('a').on('click', closeResults)

  $results.fadeIn(function () {
    // Scroll the container with all elements
    $content.parent().scrollTop(0)
  })
}

// Public Methods
// --------------

export function start () {
  var searchVal = $input.val()

  if (searchVal === '') return

  search(sidebarNodes, searchVal)
}
