'use strict'

const dataFilepath = 'dataset.csv'

d3.csv(dataFilepath, formatDataset)
  .then(drawChart)

function formatDataset(d) {

  const parseTime = d3.timeParse('%Y-%m-%d')

  return {
    shareClass: d.share_class
  , performance: parseFloat(d.performance)
  , volatility: parseFloat(d.volatility)
  , period: parseInt(d.duration)
  , periodStart: parseTime(d.start_date)
  , assetType: d.asset_type
  }

}

function drawChart(dataset) {

  const shareClasses = Array.from(new Set(dataset.map(d => d.shareClass )))

  let assetTypes = new Set(dataset.map(d => d.assetType))

  //
  // CHART CONFIG
  //

  const sliderWidth = 500
  const startingSliderValue = d3.min(dataset, d => d.periodStart )

  const totalWidth = 1200
  const totalHeight = 800
  const bufferChartAxisBottom = 10
  const bufferChartAxisLeft = 10
  // we implicitly assume the margins leave enough space for the elements around the innerchart, ie axes & slider
  const margin = { top: 60, right: 10, bottom: 40, left: 50 }
  // following measures relate to innerchart
  const width = totalWidth - margin.left - margin.right
  const height = totalHeight - margin.top - margin.bottom

  const circleRestingRadius = 3
  const circleSelectedRadius = 7

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

  innerChart // chart background
    .append('rect')
      .attr('width', width)
      .attr('height', height)

  svg // share class title
    .append('text')
      .classed('share-class-name', true)
      .attr('transform', 'translate(' + margin.left + ',' + (margin.top - 35) + ')')
      .text('')

  //
  // GRID
  //

  const xGrid = d3.axisBottom()
    .scale(x)
    .tickSize(-height)
    .tickFormat('')

  innerChart.append('g')
    .classed('grid', true)
    .attr('transform', 'translate(' + 0 + ',' + height + ')')
    .call(xGrid)

  const yGrid = d3.axisLeft()
    .scale(y)
    .tickSize(-width)
    .tickFormat('')

  innerChart.append('g')
    .classed('grid', true)
    .attr('transform', 'translate(' + 0 + ',' + 0 + ')')
    .call(yGrid)

  //
  // TOOLTIP LINE
  //

  var focus = innerChart.append('g')
    .classed('focus', true)
    .style('display', 'none')

  focus.append('line')
    .classed('vertical', true)
    .attr('y1', 0)
    .attr('y2', height)

  focus.append('line')
    .classed('horizontal', true)
    .attr('x1', 0)
    .attr('x2', width)
  //
  // SLIDER
  //

  const slider = d3.sliderBottom()
    .max(new Date)
    .min(d3.min(dataset, d => d.periodStart ))
    .width(sliderWidth)
    .fill('none')
    .ticks(8)
    .tickFormat(d3.timeFormat('%Y'))
    .default(startingSliderValue)
    .on('onchange', function(sliderValue) {
      chosenShareClass = null
      updateOnInput(dataset, chosenShareClass, sliderValue)
    })

  svg // slider element
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
    .classed('axis', true)
    .classed('x', true)
    .attr('transform', 'translate(' + margin.left + ',' + (margin.top + height + bufferChartAxisBottom) + ')')
    .call(xAxis)
    .append('text')
      .classed('axis-label', true)
      .attr('transform', 'translate(' + (4+24) + ',' + (-14) + ')')
      .text('volatility →')

  //
  // Y AXIS & GRID
  //

  const yAxis = d3.axisLeft()
    .scale(y)
    .ticks(6, ',.1')

  svg.append('g')
    .classed('axis', true)
    .classed('y', true)
    .attr('transform', 'translate(' + (margin.left - bufferChartAxisLeft) + ',' + margin.top + ')')
    .call(yAxis)
    .append('text')
      .classed('axis-label', true)
      .attr('transform', 'rotate(-90) translate(' + (-height+4+24) + ',' + (24+1) + ')')
      .text('performance →')

  //
  // FILTERING INPUT
  //

  const AssetTypeList = d3.select('div#vis')
    .append('ul')

  assetTypes.forEach(function(i) {
    AssetTypeList
      .append('li')
        .append('label')
          .text(i)
          .append('input')
            .attr('type', 'checkbox')
            .attr('name', i)
  })

  d3.selectAll('input[type=checkbox]')
    .on('change', function(event) {

      var chosenAssetTypes = []

      d3.selectAll('input[type=checkbox]').each(function(i) {
        if (this.checked) { chosenAssetTypes.push(this.name) }
      })

      if (chosenAssetTypes.length > 0) {
        let filteredDataset = dataset.filter(d => chosenAssetTypes.includes(d.assetType))
        updateOnInput(filteredDataset, null, slider.value())
      } else {
        updateOnInput(dataset, null, slider.value())
      }

    })

  //
  // DRAW DATA
  //

  let chosenShareClass = null
  updateOnInput(dataset, chosenShareClass, startingSliderValue)

  // helper functions
  function groupby(d) { return d.shareClass }
  function extractFirstItem(group) { return group[0] }

  function updateOnInput(dataset, chosenShareClass, sliderValue) {

    dataset
      .forEach(i => { i.selected = false; i.trail = false; i.background = false })

    // retrieve most recent from each share class
    var dataInSelectedRange = dataset.filter(d => d.periodStart > sliderValue)
    dataInSelectedRange = Array
      .from(d3.rollup(dataInSelectedRange, extractFirstItem, groupby)
      .values())

    let dataShareClassHistoric = (chosenShareClass !== null) ?
      dataset.filter(d => d.shareClass == chosenShareClass)
      : []

    if (chosenShareClass !== null) {

      dataInSelectedRange.filter(d => d.shareClass == chosenShareClass)
        .forEach(i => i.selected = true)

      dataInSelectedRange.filter(d => d.shareClass !== chosenShareClass)
        .forEach(i => i.background = true)

    }

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
      .data(dataset, d => d.shareClass)
      .join(selectionEnter, selectionUpdate, selectionExit)

  }

  function selectionEnter(selection) {

    selection
      .append('circle')
        .attr('r', circleRestingRadius)
        .call(drawCircles)
        .on('click', (event, d) => {

          d3.select(event.target)
            .attr('r', circleSelectedRadius)

          let chosenShareClass = d.shareClass
          updateOnInput(dataset, chosenShareClass, slider.value())

          d3.select('text.share-class-name').text(chosenShareClass)

        })
        .on('mouseover', (event, d) => {

          d3.select(event.target)
            .transition()
              .duration(100)
              .attr('r', circleSelectedRadius)

          d3.select('text.share-class-name').text(d.shareClass)

          let xPos = x(d.volatility)
          let yPos = y(d.performance)

          d3.select('g.focus')
            .style('display', null)

          d3.select('line.vertical')
            .attr('transform', 'translate(' + xPos + ',' + 0 + ')')

          d3.select('g.focus line.horizontal')
            .attr('transform', 'translate(' + 0 + ',' + yPos + ')')

        })
        .on('mouseout', (event, d) => {

          d3.select(event.target)
            .transition()
              .duration(250)
              .attr('r', circleRestingRadius)

          d3.select('text.share-class-name').text('')

          d3.select('g.focus')
            .style('display', 'none')

        })
        .append('title')
          .text(d => 'share class: ' + d.shareClass
                     + '\nstart date: ' + d3.timeFormat('%Y %b %d')(d.periodStart)
                     + '\nperf: ' + d.performance.toFixed(3)
                     + '\nvol: ' + d.volatility.toFixed(3)
                     + '\nasset type: ' + d.assetType
                )

  }

  function selectionUpdate(selection) { selection.call(drawCircles) }
  function selectionExit(selection) { selection.remove() }

  function drawCircles(circles) {

    circles
      .attr('cx', d => x(d.volatility))
      .attr('cy', d => y(d.performance))
      .classed('background', d => d.background)
      .classed('selected', d => d.selected)
      .classed('trail', d => d.trail)

  }

  svg
    .transition()
      .delay(100)
      .duration(2000)
      .ease(d3.easeLinear)
      .tween('start_date', function(){

        let a, b
        [a, b] = slider.domain()
        const i = d3.interpolateRound(a, b)

        return function(t) {

          let simulatedSliderValue = i(t)
          slider.value(simulatedSliderValue)

        }

      })

}
