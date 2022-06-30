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
  , source: d.source
  , isin: d.isin_code
  }

}

function drawChart(dataset) {

  dataset
    .forEach(i => {
      i.peers = i.source == 'peers'
      i.benchmark = i.source == 'benchmark'
    })

  const shareClasses = Array.from(new Set(dataset.map(d => d.shareClass )))
  const assetTypes = new Set(dataset.map(d => d.assetType))

  //
  // CHART CONFIG
  //

  const sliderWidth = 500
  const spaceForPlayButton = 30
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

  const shapeSizeDefault = 100
  const shapeSizeFocused = 400
  const shapeSizeSelected = 180

  const shapesMapping = {
      'shareclass': d3.symbolCircle
    , 'benchmark': d3.symbolSquare
    , 'peers': d3.symbolWye
  }

  // global tracking of state / interaction history / user journey; this will be updated
  const state = {
      'selected_isins': null
    , 'highlighted_isins': null
    , 'slider': null
    , 'zoom': null
  }

  //
  // SCALES
  //

  const xScale = d3.scaleLinear()
    .domain(d3.extent(dataset, d => d.volatility ))
    .range([0, width])
    .nice()

  const yScale = d3.scaleLinear()
    .domain(d3.extent(dataset, d => d.performance ))
    .range([height, 0])
    .nice()

  const shapeScale = d3.scaleOrdinal(Object.keys(shapesMapping), Object.values(shapesMapping))

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

  const innerChart = svg
    .append('g')
      .classed('chart', true)
      .attr('transform', `translate(${margin.left}, ${margin.top})`)
      .attr('width', width)
      .attr('height', height)
      .attr('clip-path', 'url(#clip)')

  const innerChartBackground = innerChart
    .append('rect')
      .classed('background', true)
      .attr('width', width)
      .attr('height', height)

  svg // shareClass title
    .append('text')
      .classed('share-class-name', true)
      .attr('transform', `translate(${margin.left}, ${margin.top - 35})`)
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
    .attr('transform', `translate(${0}, ${height})`)
    .call(xGrid)

  const yGrid = d3.axisLeft()
    .scale(yScale)
    .ticks(6)
    .tickSize(-width)
    .tickFormat('')

  const yGridElement = innerChart.append('g')
    .classed('grid', true)
    .attr('transform', `translate(${0}, ${0})`)
    .call(yGrid)

  //
  // TOOLTIP LINE
  //

  const focus = innerChart.append('g')
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
    .attr('transform', `translate(${margin.left}, ${margin.top + height + bufferChartAxisBottom})`)
    .call(xAxis)

  xAxisElement.append('text')
    .classed('axis-label', true)
    .attr('transform', `translate(${4+24}, ${-14})`)
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
    .attr('transform', `translate(${margin.left - bufferChartAxisLeft}, ${margin.top})`)
    .call(yAxis)

  yAxisElement.append('text')
    .classed('axis-label', true)
    .attr('transform', `rotate(-90) translate(${-height+4+24}, ${24+1})`)
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

        const filtered = new Set(dataset
          .filter(d => chosenAssetTypes.includes(d.assetType))
          .map(d => d.isin)
        )

        state.highlighted_isins = filtered
        updateOnInput()

      } else { // everything is unticked => show all

        state.highlighted_isins = new Set(dataset.map(d => d.isin))
        updateOnInput()

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
    .on('start', function(sliderValue) {
      // TODO there's some weird lag where the user must click twice

      stopAnimation()

    })
    .on('onchange', function(sliderValue) {

      state.slider = sliderValue
      updateOnInput()

    })

  svg // slider element
    .append('g')
      .attr('id', 'slider')
      .attr('transform', 'translate(' + (totalWidth - sliderWidth - margin.right - 10 - spaceForPlayButton) + ',' + 10 + ')')
      .call(slider)

  const playButtonText = '◀'
  const pauseButtonText = '❚❚'

  const playButton = svg.select('g#slider')
    .append('text')
      .attr('id', 'play-button')
      .attr('transform', `translate(${sliderWidth + spaceForPlayButton - 3}, ${5})`)
      .text(playButtonText)
      .on('click', function(event) {

        const animation_is_playing = playButton.text() == pauseButtonText

        if (animation_is_playing) {
          stopAnimation()
        } else {
          animateThroughTime()
        }

      })

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

    // TODO update drawn datapoints
    state.zoom = null
    updateOnInput()

    // TODO create a "reset zoom" button

  }

  const zoom = d3.zoom()
    .scaleExtent([0.8, 3])
    //.extent([[0, 0], [width, height]])
    //.translateExtent([[-100, -100], [width + 90, height + 100]])
    .on('zoom', handleZoom)

  innerChartBackground.call(zoom)

  //
  // DRAW DATA
  //

  updateOnInput()

  //
  // HELPER FUNCTIONS
  //

  function groupby(d) { return d.shareClass }
  function extractFirstItem(group) { return group[0] }

  function updateOnInput() {

    // the default is to show what is already there
    const selected_isins = state.selected_isins || null
    const highlighted_isins = state.highlighted_isins || new Set(dataset.map(d => d.isin))
    const sliderValue = state.slider || slider.value()
    const zoom = state.zoom || null

    const dots_are_selected = selected_isins !== null

    // TODO cleaner to have a scoped dataset inside here (?)
    dataset // reset state
      .forEach(i => {
        i.selected = false
        i.background = false
      })

    // retrieve most recent from each share class
    var dataToShow = dataset
      .filter(d => d.periodStart > sliderValue)
      .filter(d => highlighted_isins.has(d.isin))
      .filter(d => d.isin == selected_isins || d.source == 'shareclass')

    var dataToShow = Array.from(d3
      .rollup(dataToShow, extractFirstItem, groupby)
      .values()
      )

    if (dots_are_selected) {

      dataToShow.filter(d => d.isin == selected_isins)
        .forEach(i => i.selected = true)

      dataToShow.filter(d => d.isin !== selected_isins)
        .forEach(i => i.background = true)

    }

    drawData(dataToShow)

  }

  function drawData(dataset) {

    innerChart.selectAll('path.symbol')
      .data(dataset, d => d.shareClass)
      .join(selectionEnter, selectionUpdate, selectionExit)

  }

  function selectionEnter(selection) {

    const dots = selection
      .append('path')

    dots
      .attr('d', d => d3.symbol().type( shapeScale(d.source) ).size(shapeSizeDefault)())
      .attr('class', d => d.assetType)
      .classed('symbol', true) // TODO find out why this needs to be placed after the previous lines
      .classed('selected', d => d.selected)
      .classed('background', d => d.background)
      .classed('peers', d => d.peers)
      .classed('benchmark', d => d.benchmark)
      .call(positionDot)
      .on('click', (event, d) => {
        // TODO factor out A. when a new selected group is drawn, B. when group is de-selected

        d3.selectAll('.trail')
          .remove()

        // all other circles must return to original size
        // TODO fix bug: maybe this is causing a glitch
        dots
          .attr('d', d => d3.symbol().type( shapeScale(d.source) ).size(shapeSizeDefault)())

        state.selected_isins = d.isin
        drawTrail(d.isin)
        updateOnInput()

        d3.select(event.target)
          .attr('d', d => d3.symbol().type( shapeScale(d.source) ).size(shapeSizeFocused)())
          .raise()

        d3.select('text.share-class-name').text(d.shareClass)

      })
      .on('mouseover', (event, d) => {

        const dot = d3.select(event.target)
        dot.raise()

        dot
          .classed('background', false)
          .transition()
            .duration(100)
            .attr('d', d => d3.symbol().type( shapeScale(d.source) ).size(shapeSizeFocused)())

        d3.select('text.share-class-name').text(d.shareClass)

        // draw the focus line

        const xPos = xScale(d.volatility)
        const yPos = yScale(d.performance)

        focus
          .style('display', null)

        focus.select('line.vertical')
          .attr('transform', `translate(${xPos}, ${0})`)

        focus.select('line.horizontal')
          .attr('transform', `translate(${0}, ${yPos})`)

      })
      .on('mouseout', (event, d) => {

        const dot = d3.select(event.target)
        const dots_are_selected_but_not_this_dot = state.selected_isins && !dot.classed('selected')
        // this distinction is important because of the state where nothing is selected, you don't want dots going into background mode

        if (dots_are_selected_but_not_this_dot) {

          dot.classed('background', true)
          d3.select('text.share-class-name').text('')

        }

        if (!dot.classed('selected')) {

          dot
            .transition()
              .duration(250)
              .attr('d', d => d3.symbol().type( shapeScale(d.source) ).size(shapeSizeDefault)())

        } else {

          dot
            .transition()
              .duration(250)
              .attr('d', d => d3.symbol().type( shapeScale(d.source) ).size(shapeSizeSelected)())

        }

        d3.select('g.focus')
          .style('display', 'none')

      })

    dots.append('title')
      .classed('tooltip', true)
      .text(tooltipText)

  }

  function selectionUpdate(selection) {

    selection
      .classed('selected', d => d.selected)
      .classed('background', d => d.background)
      .transition()
        .delay(0)
        .duration(50)
        .ease(d3.easeLinear)
        .call(positionDot)

    d3.selectAll('title.tooltip')
      .remove()

    selection.append('title')
      .classed('tooltip', true)
      .text(tooltipText)

  }

  function selectionExit(selection) {

    selection
      .remove()

  }

  function positionDot(selection) {

    selection
      .attr('transform', d => `translate(${xScale(d.volatility)}, ${yScale(d.performance)})`)

  }

  function drawTrail(isin) {

    const trailData = dataset
      .filter(d => d.isin == isin && d.source == 'shareclass')

    innerChart
      .append('path')
        .datum(trailData)
        .classed('trail', true)
        .attr('d', d3.line()
          .curve(d3.curveCardinal.tension(0.0))
          .x(d => xScale(d.volatility))
          .y(d => yScale(d.performance))
        )

    innerChart.selectAll('circle.trail')
      .data(trailData)
      .enter()
        .append('circle')
          .classed('trail', true)
          .attr('cx', d => xScale(d.volatility))
          .attr('cy', d => yScale(d.performance))

  }

  function animateThroughTime() {

    playButton.text(pauseButtonText)

    // disable zoom
    innerChartBackground.on('.zoom', null)

    svg.transition()
      .delay(200)
      .duration(18000)
      .ease(d3.easeLinear)
      .tween('start_date', function(){

        let far, recent
        [far, recent] = slider.domain()
        const current = slider.value()

        const i = d3.interpolateRound(current, far)

        return function(t) {

          const simulatedSliderValue = i(t)
          slider.value(simulatedSliderValue)

        }

      })
      .on('end', function() {

        playButton.text(playButtonText)
        innerChartBackground.call(zoom)

      })

  }

  function stopAnimation() {

      // stop animation
      svg.transition().duration(0)

      // re-enable zoom
      innerChartBackground.call(zoom)

      playButton.text(playButtonText)

  }

  function tooltipText(d) {

    const text = ''
             + '\nsource: ' + d.source
             + '\nshare class: ' + d.shareClass
             + '\nISIN code: ' + d.isin
             + '\nstart date: ' + d3.timeFormat('%Y %b %d')(d.periodStart)
             + '\nperf: ' + (d.performance * 100).toFixed(1) + '%'
             + '\nvol: ' + (d.volatility * 100).toFixed(1) + '%'
             + '\nasset type: ' + d.assetType
    return text

  }

}

// TODO bug: if animation is in place and i mouseover a dot it doesn't come out of background, and if i click on a dot it is selected but doesn't come out of focused selected size (ie stays big size as if mouseout event wasn't triggered)

