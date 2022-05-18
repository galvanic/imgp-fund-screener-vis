'use strict'

const dataFilepath = 'dataset.csv'

d3.csv(dataFilepath, formatDataset, drawChart)

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

  console.table(dataset.slice(0, 3))

  // make a random share class as if selected
  const shareClasses = Array.from(new Set(dataset.map(function(d) { return d.share_class })))
  var randomShareClass = shareClasses[Math.floor(Math.random()*shareClasses.length)]
  let chosenShareClass = randomShareClass
  dataset
    .filter(function(d) { return d.share_class == chosenShareClass })
    .forEach(function(i) { i.selected = true })

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

  var x = d3.scale.linear()
    .domain(d3.extent(dataset, function(d) { return d.volatility }))
    .range([0, width])
    .nice()

  var y = d3.scale.linear()
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
        d3.select('output').text(sliderValue)

        var dataInSelectedRange = dataset.filter(function(d) { return d.period < sliderValue })
        dataInSelectedRange = d3.nest()
          .key(function(d) { return d.share_class })
	  .rollup(function(group) { return group[0] })
          .entries(dataInSelectedRange)
	  .map(function(d) { return d.values })

        drawData(dataInSelectedRange)
	console.log(sliderValue)
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

  var xAxis = d3.svg.axis()
    .scale(x)
    .orient('bottom')
    .ticks(6, ',.1')
    .outerTickSize(1)

  svg.append('g')
    .classed('xaxis', true)
    .attr('transform', 'translate(' + margin.left + ',' + (margin.top + height + bufferChartAxisBottom) + ')')
    .call(xAxis)

  //
  // Y AXIS & GRID
  //

  var yAxis = d3.svg.axis()
    .scale(y)
    .orient('left')
    .outerTickSize(1)

  svg.append('g')
    .classed('yaxis', true)
    .attr('transform', 'translate(' + (margin.left - bufferChartAxisLeft) + ',' + margin.top + ')')
    .call(yAxis)

  //
  // DRAW DATA
  //

  var dataInSelectedRange = dataset.filter(function(d) { return d.period < startingSliderValue })
  dataInSelectedRange = d3.nest()
    .key(function(d) { return d.share_class })
    .rollup(function(group) { return group[0] })
    .entries(dataInSelectedRange)
    .map(function(d) { return d.values })
  var dataShareClassHistoric = dataset.filter(function(d) { return d.share_class == chosenShareClass })
  dataInSelectedRange.concat(dataShareClassHistoric)
  drawData(dataInSelectedRange)

  console.log({dataShareClassHistoric})
  console.log({dataInSelectedRange})

  function drawData(dataset) {

    var circles = innerChart.selectAll('circle')
      .data(dataset)

    circles.enter()
      .append('circle')

    circles
      .style('fill', 'gray')
      .attr('cx', function(d) { return x(d.volatility) })
      .attr('cy', function(d) { return y(d.performance) })
      .classed('selected', function(d) { return d.selected })
      .attr('data', function (d) { return 'period: ' + d.period + ', perf: ' + d.performance + ', vol: ' + d.volatility })

    circles.exit()
      .remove()

  }

}

