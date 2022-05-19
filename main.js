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

  const shareClasses = Array.from(new Set(dataset.map(d => d.share_class )))

  //
  // CHART CONFIG
  //

  const sliderWidth = 300
  const startingSliderValue = d3.max(dataset, d => d.period )

  const totalWidth = 1200
  const totalHeight = 800
  const bufferChartAxisBottom = 10
  const bufferChartAxisLeft = 10
  // we implicitly assume the margins leave enough space for the elements around the innerchart, ie axes & slider
  const margin = { top: 60, right: 10, bottom: 40, left: 50 }
  // following measures relate to innerchart
  const width = totalWidth - margin.left - margin.right
  const height = totalHeight - margin.top - margin.bottom

  //
  // SCALES
  //

  const x = d3.scaleLinear()
    .domain(d3.extent(dataset, d => d.volatility ))
    .range([0, width])
    .nice()

  const y = d3.scaleLinear()
    .domain(d3.extent(dataset, d => d.performance ))
    .range([height, 0])
    .nice()

  const historicness = d3.scaleLinear()
    .domain(d3.extent(dataset, d => d.period ))
    .range([1, 0.5])
    .nice()

  //
  // DRAW CHART
  //

  const svg = d3.select('div#vis')
    .append('svg')
      .attr('width', totalWidth)
      .attr('height', totalHeight)

  const innerChart = svg
    .append('g')
      .classed('chart', true)
      .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
      .attr('width', width)
      .attr('height', height)

  const chartBackground = innerChart
    .append('rect')
      .attr('width', width)
      .attr('height', height)
      .style('fill', 'bisque')

  const titleElement = svg
    .append('text')
      .classed('share-class-name', true)
      .attr('transform', 'translate(' + margin.left + ',' + (margin.top - 20) + ')')
      .text('')

  //
  // SLIDER
  //

  const slider = d3.sliderBottom()
    .max(d3.min(dataset, d => d.period + 1 ))
    .min(d3.max(dataset, d => d.period - 1 ))
    .width(sliderWidth)
    .fill('chocolate')
    .step(50)
    .ticks(5)
    .default(startingSliderValue)
    .on('onchange', function(sliderValue) {
      chosenShareClass = null
      updateOnInput(dataset, chosenShareClass, sliderValue)
    })

  const sliderElement = svg
    .append('g')
      .attr('id', 'slider')
      .attr('transform', 'translate(' + (totalWidth - sliderWidth - margin.right - 10) + ',' + 10 + ')')
      .call(slider)

  //
  // X AXIS & GRID
  //

  const xAxis = d3.axisBottom()
    .scale(x)
    .ticks(6, ',.1')

  svg.append('g')
    .classed('xaxis', true)
    .attr('transform', 'translate(' + margin.left + ',' + (margin.top + height + bufferChartAxisBottom) + ')')
    .call(xAxis)

  //
  // Y AXIS & GRID
  //

  const yAxis = d3.axisLeft()
    .scale(y)
    .ticks(6, ',.1')

  svg.append('g')
    .classed('yaxis', true)
    .attr('transform', 'translate(' + (margin.left - bufferChartAxisLeft) + ',' + margin.top + ')')
    .call(yAxis)

  //
  // DRAW DATA
  //

  let chosenShareClass = null
  updateOnInput(dataset, chosenShareClass, startingSliderValue)

  function updateOnInput(dataset, chosenShareClass, sliderValue) {

    dataset
      .forEach(i => { i.selected = false; i.trail = false })

    // retrieve most recent from each share class
    function groupby(d) { return d.share_class }
    function extractFirstItem(group) { return group[0] }

    var dataInSelectedRange = dataset.filter(d => d.period < sliderValue)
    dataInSelectedRange = Array
      .from(d3.rollup(dataInSelectedRange, extractFirstItem, groupby)
      .values())

    let dataShareClassHistoric = (chosenShareClass !== null) ?
      dataset.filter(d => d.share_class == chosenShareClass)
      : []

    dataInSelectedRange.filter(d => d.share_class == chosenShareClass)
      .forEach(i => i.selected = true)

    dataShareClassHistoric
      .forEach(i => i.trail = true)

    let dataVisible = Array.from(new Set(dataShareClassHistoric.concat(dataInSelectedRange)))

    // pick out the selected circle, so that it can be drawn at the end
    if (chosenShareClass !== null) {
      let selectedCircle = Array.from(d3.intersection(dataInSelectedRange, dataShareClassHistoric))[0]
      dataVisible.push(selectedCircle)
    }

    drawData(dataVisible)

  }

  function drawData(dataset) {

    let circles = innerChart.selectAll('circle')
      .data(dataset)
      .join(selectionEnter, selectionUpdate, selectionExit)

    function selectionEnter(selection) { selection.append('circle').call(drawCircles) }
    function selectionUpdate(selection) { selection.call(drawCircles) }
    function selectionExit(selection) { selection.remove() }

  }

  function drawCircles(circles) {

    circles
      .attr('cx', d => x(d.volatility))
      .attr('cy', d => y(d.performance))
      .attr('filter', d => 'brightness(' + historicness(d.period) + ')')
      .classed('selected', d => d.selected)
      .classed('trail', d => d.trail)
      .on('click', (event, d) => {

        let sliderValue = slider.value()
        let chosenShareClass = d.share_class

        updateOnInput(dataset, chosenShareClass, sliderValue)

        d3.select('text.share-class-name').text(chosenShareClass)

      })
      .append('title')
        .text(d => 'share class: ' + d.share_class
                   + '\nperiod: ' + d.period
                   + '\nperf: ' + d.performance
                   + '\nvol: ' + d.volatility)

  }

}

