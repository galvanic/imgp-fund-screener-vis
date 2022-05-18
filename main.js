'use strict'

const dataFilepath = 'dataset.csv'

d3.csv(dataFilepath, formatDataset)
  .then(drawChart)

function formatDataset(d) {

  return {
    share_class: d.share_class
  , performance: parseFloat(d.performance)
  , volatility: parseFloat(d.volatility)
  , period: parseInt(d.duration)
  , selected: false
  }

}

function drawChart(dataset) {

  // make a random share class as if selected
  const shareClasses = Array.from(new Set(dataset.map(function(d) { return d.share_class })))
  var randomShareClass = shareClasses[Math.floor(Math.random()*shareClasses.length)]
  let chosenShareClass = randomShareClass
  console.log({chosenShareClass})

  //
  // CHART CONFIG
  //

  const startingSliderValue = d3.max(dataset, function(d) { return d.period })
  const totalWidth = 1200
  const totalHeight = 800
  const bufferChartAxisBottom = 10
  const bufferChartAxisLeft = 10
  // we implicitly assume the margins leave enough space for the elements around the innerchart, ie axes & slider
  const margin = { top: 50, right: 10, bottom: 40, left: 50 }
  // following measures relate to innerchart
  const width = totalWidth - margin.left - margin.right
  const height = totalHeight - margin.top - margin.bottom

  //
  // SCALES
  //

  var x = d3.scaleLinear()
    .domain(d3.extent(dataset, function(d) { return d.volatility }))
    .range([0, width])
    .nice()

  var y = d3.scaleLinear()
    .domain(d3.extent(dataset, function(d) { return d.performance }))
    .range([height, 0])
    .nice()

  //
  // SLIDER
  //

  var slider = d3.select('div#vis')
    .append('input')
      .attr('type', 'range')
      .attr('min', d3.min(dataset, function(d) { return d.period + 1 }))
      .attr('max', d3.max(dataset, function(d) { return d.period - 1 }))
      .attr('step', 1)
      .attr('value', startingSliderValue)
      .on('input', function() {

        var sliderValue = this.value

        dataset
          .forEach(function(i) { i.selected = false })

        var dataInSelectedRange = retrieveShareClassMostRecent(dataset, sliderValue)
        var dataShareClassHistoric = dataset.filter(function(d) { return d.share_class == chosenShareClass })

        dataInSelectedRange.filter(function(d) { return d.share_class == chosenShareClass })
          .forEach(function(i) { i.selected = true })

        var dataVisible = dataShareClassHistoric.concat(dataInSelectedRange)
        drawData(dataVisible)

      })

  //
  // DRAW CHART
  //

  var svg = d3.select('div#vis')
    .append('svg')
      .attr('width', totalWidth)
      .attr('height', totalHeight)

  var innerChart = svg
    .append('g')
      .classed('chart', true)
      .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
      .attr('width', width)
      .attr('height', height)

  var chartBackground = innerChart
    .append('rect')
      .attr('width', width)
      .attr('height', height)
      .style('fill', 'bisque')

  //
  // X AXIS & GRID
  //

  var xAxis = d3.axisBottom()
    .scale(x)
    .ticks(6, ',.1')

  svg.append('g')
    .classed('xaxis', true)
    .attr('transform', 'translate(' + margin.left + ',' + (margin.top + height + bufferChartAxisBottom) + ')')
    .call(xAxis)

  //
  // Y AXIS & GRID
  //

  var yAxis = d3.axisLeft()
    .scale(y)
    .ticks(6, ',.1')

  svg.append('g')
    .classed('yaxis', true)
    .attr('transform', 'translate(' + (margin.left - bufferChartAxisLeft) + ',' + margin.top + ')')
    .call(yAxis)

  //
  // DRAW DATA
  //

  var dataInSelectedRange = retrieveShareClassMostRecent(dataset, startingSliderValue)
  var dataShareClassHistoric = dataset.filter(function(d) { return d.share_class == chosenShareClass })

  dataInSelectedRange.filter(function(d) { return d.share_class == chosenShareClass })
    .forEach(function(i) { i.selected = true })

  dataShareClassHistoric
    .forEach(function(i) { i.trail = true })

  var dataVisible = new Set(dataShareClassHistoric.concat(dataInSelectedRange))
  drawData(dataVisible)


  function drawData(dataset) {

    var circles = innerChart.selectAll('circle')
      .data(dataset)

    // TODO DRY
    circles.enter()
      .append('circle')
        .attr('cx', function(d) { return x(d.volatility) })
        .attr('cy', function(d) { return y(d.performance) })
        .classed('selected', function(d) { return d.selected })
        .classed('trail', function(d) { return d.trail })
        .attr('data', function (d) { return 'period: ' + d.period + ', perf: ' + d.performance + ', vol: ' + d.volatility })

    circles
      .attr('cx', function(d) { return x(d.volatility) })
      .attr('cy', function(d) { return y(d.performance) })
      .classed('selected', function(d) { return d.selected })
      .classed('trail', function(d) { return d.trail })
      .attr('data', function (d) { return 'period: ' + d.period + ', perf: ' + d.performance + ', vol: ' + d.volatility })

    circles.exit()
      .remove()

  }

}

function retrieveShareClassMostRecent(dataset, sliderValue) {

  function groupby(d) { return d.share_class }
  function extractFirst(group) { return group[0] }

  var dataInSelectedRange = dataset.filter(function(d) { return d.period < sliderValue })
  var data = Array.from(d3.rollup(dataInSelectedRange, extractFirst, groupby).values())

  return data

}


