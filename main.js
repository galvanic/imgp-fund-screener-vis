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
  const sliderValueAtPageLoad = d3.max(dataset, d => d.periodStart )

  const totalWidth = 1200
  const totalHeight = 800
  const bufferChartAxisBottom = 10
  const bufferChartAxisLeft = 10
  // we implicitly assume the margins leave enough space for the elements around the innerchart, ie axes & slider
  const margin = { top: 60, right: 10, bottom: 40, left: 50 }
  // following measures relate to innerchart
  const width = totalWidth - margin.left - margin.right
  const height = totalHeight - margin.top - margin.bottom

  const circleRestingRadius = 5
  const circleSelectedRadius = 8

  //
  // SCALES
  //

  let xScale = d3.scaleLinear()
    .domain(d3.extent(dataset, d => d.volatility ))
    .range([0, width])
    .nice()

  let yScale = d3.scaleLinear()
    .domain(d3.extent(dataset, d => d.performance ))
    .range([height, 0])
    .nice()

  //
  // DRAW CHART
  //

  const svg = d3.select('div#vis')
    .append('svg')
      .attr('width', totalWidth)
      .attr('height', totalHeight)

  svg.append('clipPath')
    .attr('id', 'clip')
    .append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('x', 0)
      .attr('y', 0)

  let innerChart = svg
    .append('g')
      .classed('chart', true)
      .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
      .attr('width', width)
      .attr('height', height)
      .attr('clip-path', 'url(#clip)')

  innerChart // chart background
    .append('rect')
      .classed('background', true)
      .attr('width', width)
      .attr('height', height)
    .on('click', (event, d) => {

      let chosenShareClass = null
      updateOnInput(dataset, chosenShareClass, slider.value())

    })

  svg // shareClass title
    .append('text')
      .classed('share-class-name', true)
      .attr('transform', 'translate(' + margin.left + ',' + (margin.top - 35) + ')')
      .text('')

  //
  // GRID
  //

  const xGrid = d3.axisBottom()
    .scale(xScale)
    .ticks(6)
    .tickSize(-height)
    .tickFormat('')

  const xGridElement = innerChart.append('g')
    .classed('grid', true)
    .attr('transform', 'translate(' + 0 + ',' + height + ')')
    .call(xGrid)

  const yGrid = d3.axisLeft()
    .scale(yScale)
    .ticks(6)
    .tickSize(-width)
    .tickFormat('')

  const yGridElement = innerChart.append('g')
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
  // X AXIS
  //

  const xAxis = d3.axisBottom()
    .scale(xScale)
    .ticks(6, ',%')

  const xAxisElement = svg.append('g')
    .classed('axis', true)
    .classed('x', true)
    .attr('transform', 'translate(' + margin.left + ',' + (margin.top + height + bufferChartAxisBottom) + ')')
    .call(xAxis)

  xAxisElement.append('text')
    .classed('axis-label', true)
    .attr('transform', 'translate(' + (4+24) + ',' + (-14) + ')')
    .text('volatility →')

  //
  // Y AXIS
  //

  const yAxis = d3.axisLeft()
    .scale(yScale)
    .ticks(6, '+,%')

  const yAxisElement = svg.append('g')
    .classed('axis', true)
    .classed('y', true)
    .attr('transform', 'translate(' + (margin.left - bufferChartAxisLeft) + ',' + margin.top + ')')
    .call(yAxis)

  yAxisElement.append('text')
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
          .classed(i, true)
          .text(i.replace(/_/g, ' '))
          .append('input')
            .attr('type', 'checkbox')
            .attr('name', i)
  })

  d3.selectAll('input[type=checkbox]')
    .each(function(i) {
      this.checked = true
    })
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
  // SLIDER
  //

  const slider = d3.sliderBottom()
    .min(d3.min(dataset, d => d.periodStart ))
    .max(d3.max(dataset, d => d.periodStart ) - 1)
    .width(sliderWidth)
    .fill('none')
    .ticks(8)
    .tickFormat(d3.timeFormat('%Y'))
    .displayFormat(d3.timeFormat('%Y %b %d'))
    .default(sliderValueAtPageLoad)
    .on('onchange', function(sliderValue) {
      chosenShareClass = null
      updateOnInput(dataset, chosenShareClass, sliderValue)
    })

  svg // slider element
    .append('g')
      .attr('id', 'slider')
      .attr('transform', 'translate(' + (totalWidth - sliderWidth - margin.right - 10) + ',' + 10 + ')')
      .call(slider)
    .on('mouseover', function() {

      // stop animation
      svg.transition().duration(0)

      // re-enable zoom
      innerChart.call(zoom)

    })
    .append('text')
      .attr('id', 'play-button')
      .text('◀')

  //
  // ZOOM
  //

  const handleZoom = function(e) {

    // compute the new scale
    const newXScale = e.transform.rescaleX(xScale)
    const newYScale = e.transform.rescaleY(yScale)

    // update axes & grid
    xAxisElement.call(xAxis.scale(newXScale))
    yAxisElement.call(yAxis.scale(newYScale))
    xGridElement.call(xGrid.scale(newXScale))
    yGridElement.call(yGrid.scale(newYScale))

    // update drawn datapoints
    d3.selectAll('circle')
      .attr('cx', d => newXScale(d.volatility))
      .attr('cy', d => newYScale(d.performance))
      .on('mouseover', (event, d) => {

        d3.select(event.target)
          .transition()
            .duration(100)
            .attr('r', circleSelectedRadius)

        d3.select('text.share-class-name').text(d.shareClass)

        let xPos = newXScale(d.volatility)
        let yPos = newYScale(d.performance)

        d3.select('g.focus')
          .style('display', null)

        d3.select('g.focus line.vertical')
          .attr('transform', 'translate(' + xPos + ',' + 0 + ')')

        d3.select('g.focus line.horizontal')
          .attr('transform', 'translate(' + 0 + ',' + yPos + ')')

      })

    // TODO create a "reset zoom" button

  }

  const zoom = d3.zoom()
    .scaleExtent([0.8, 3])
    //.extent([[0, 0], [width, height]])
    //.translateExtent([[-100, -100], [width + 90, height + 100]])
    .on('zoom', handleZoom)

  //
  // DRAW DATA
  //

  let chosenShareClass = null
  updateOnInput(dataset, chosenShareClass, sliderValueAtPageLoad)

  animateThroughTime()

  // helper functions
  function groupby(d) { return d.shareClass }
  function extractFirstItem(group) { return group[0] }

  function updateOnInput(dataset, chosenShareClass, sliderValue) {

    dataset
      .forEach(i => { i.selected = false; i.background = false })

    // retrieve most recent from each share class
    var dataInSelectedRange = dataset.filter(d => d.periodStart > sliderValue)
    dataInSelectedRange = Array
      .from(d3.rollup(dataInSelectedRange, extractFirstItem, groupby)
      .values())

    if (chosenShareClass !== null) {

      dataInSelectedRange.filter(d => d.shareClass == chosenShareClass)
        .forEach(i => i.selected = true)

      dataInSelectedRange.filter(d => d.shareClass !== chosenShareClass)
        .forEach(i => i.background = true)

    }

    drawData(dataInSelectedRange)

  }

  function drawData(dataset) {

    innerChart.selectAll('circle')
      .data(dataset, d => d.shareClass)
      .join(selectionEnter, selectionUpdate, selectionExit)

  }

  function selectionEnter(selection) {

    let circles = selection.append('circle')

    circles
      .attr('r', 0)
      .attr('class', d => d.assetType)
      .classed('selected', d => d.selected)
      .classed('background', d => d.background)
      .call(positionCircle)
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

        let xPos = xScale(d.volatility)
        let yPos = yScale(d.performance)

        d3.select('g.focus')
          .style('display', null)

        d3.select('g.focus line.vertical')
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

    circles.append('title')
      .classed('tooltip', true)
      .text(tooltipText)

    circles.transition()
      .duration(150)
      .attr('r', circleRestingRadius)

  }

  function selectionUpdate(selection) {

    selection
      .attr('r', circleRestingRadius)
      // ^ needed in case the enter transition didn't finish; otherwise the radius is too small for the circle to be visible
      .classed('selected', d => d.selected)
      .classed('background', d => d.background)
      .transition()
        .delay(0)
        .duration(50)
        .ease(d3.easeLinear)
        .call(positionCircle)

    d3.selectAll('title.tooltip')
      .remove()

    selection.append('title')
      .classed('tooltip', true)
      .text(tooltipText)

  }

  function selectionExit(selection) {

    selection
      .transition()
        .duration(200)
        .attr('r', 0)
      .remove()

  }

  function positionCircle(circles) {

    circles
      .attr('cx', d => xScale(d.volatility))
      .attr('cy', d => yScale(d.performance))

  }

  function animateThroughTime() {

    innerChart.on('.zoom', null)

    svg.transition()
      .delay(200)
      .duration(18000)
      .ease(d3.easeLinear)
      .tween('start_date', function(){

        let a, b
        [a, b] = slider.domain()
        const i = d3.interpolateRound(b, a)

        return function(t) {

          let simulatedSliderValue = i(t)
          slider.value(simulatedSliderValue)

        }

      })
      .on('end', function() {
        innerChart.call(zoom)
      })

  }

  function tooltipText(d) {

    let text = ''
             + 'share class: ' + d.shareClass
             + '\nstart date: ' + d3.timeFormat('%Y %b %d')(d.periodStart)
             + '\nperf: ' + d.performance.toFixed(3)
             + '\nvol: ' + d.volatility.toFixed(3)
             + '\nasset type: ' + d.assetType
    return text

  }

}
