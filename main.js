'use strict'

const dataFilepath = 'dataset.csv'

d3.csv(dataFilepath, formatDataset)
  .then(drawChart)

function formatDataset(d) {

  const parseTime = d3.timeParse('%Y-%m-%d')

  return {
    groupingID: d.grouping_id
  , isin: d.isin
  , assetType: d.asset_type
  , source: d.source
  , mstarcode: d.mstarcode
  , name: d.name
  , periodStart: parseTime(d.start_date)
  , periodEnd: parseTime(d.end_date)
  , periodLength: parseInt(d.period_length_yrs)
  , performance: parseFloat(d.performance) / 100
  , volatility: parseFloat(d.volatility) / 100
  }

}

function drawChart(dataset) {

  dataset.sort((a, b) => { b.periodStart - a.periodStart })
  dataset
    .forEach(i => {
      i.peers = i.source == 'category'
      i.benchmark = i.source == 'bench'
    })


  //
  // CHART CONFIG
  //

  const sliderWidth = 1090
  const spaceForPlayButton = 30
  const sliderValueAtPageLoad = d3.max(dataset, d => d.periodEnd)
  const defaultPeriodLength = 3 // years

  const totalWidth = 1200
  const totalHeight = 800
  const bufferChartAxisBottom = 10
  const bufferChartAxisLeft = 10
  // we implicitly assume the margins leave enough space for the elements around the innerchart, ie axes & slider
  const margin = { top: 60, right: 10, bottom: 40, left: 50 }
  // following measures relate to innerchart
  const width = totalWidth - margin.left - margin.right
  const height = totalHeight - margin.top - margin.bottom

  const shapeSizeDefault = 300
  const shapeSizeFocused = 700
  const shapeSizeSelected = 400

  const sizeMappingIfSelected = {
      'true': shapeSizeSelected
    , 'false': shapeSizeDefault
  }

  const shapesMapping = {
      'share': d3.symbolCircle
    , 'bench': d3.symbolSquare
    , 'category': d3.symbolWye
  }

  const timingDotMovement = 200 // msec, used also for zoom axis & grid change

  // global tracking of state / interaction history / user journey; this will be updated
  const state = {
      'selected_ids': null
    , 'selected_period_length': null
    , 'highlighted_ids': null
    , 'slider': null
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

  // declare these defaults after the d3 scale is declared, to take the .nice() into account
  const xDomainDefault = xScale.domain()
  const yDomainDefault = yScale.domain()

  const shapeScale = d3.scaleOrdinal(Object.keys(shapesMapping), Object.values(shapesMapping))
  const sizeScale = d3.scaleOrdinal(Object.keys(sizeMappingIfSelected), Object.values(sizeMappingIfSelected))

  //
  // FILTERING INPUT BY ASSET TYPE
  //

  const AssetTypeList = d3.select('div#vis')
    .append('ul')
      .classed('asset-types', true)

  const assetTypes = new Set(dataset
    .filter(d => d.assetType != '') // TODO roundabout fix for bug where bench&cat have assettype
    .map(d => d.assetType)
  )

  // TODO refactor below in d3's declarative way instead of procedural
  assetTypes.forEach((i) => {
    AssetTypeList
      .append('li')
        .append('label')
          .classed(i, true)
          .text(i.replace(/_/g, ' '))
          .append('input')
            .attr('type', 'checkbox')
            .attr('name', i)
  })

  //
  // FILTERING INPUT BY LOOKBACK PERIOD LENGTH
  //

  d3.selectAll('input[type=checkbox]')
    .each(function(i) {
      this.checked = true
    })
    .on('change', function(event) {

      var chosenAssetTypes = []

      d3.selectAll('input[type=checkbox]').each(function(i) {
        if (this.checked) { chosenAssetTypes.push(this.name) }
      })

      // if unhighlighted included one that was selected, reset selection to none
      const assetTypeOfSelected = dataset
        .filter(d => d.groupingID == state.selected_ids)
        .filter(d => d.source == 'share')
        .map(d => d.assetType)
        [0]

      if (!chosenAssetTypes.includes(assetTypeOfSelected)) {
        state.selected_ids = null
        updateOnInput()
      }

      if (chosenAssetTypes.length > 0) {

        const filtered = new Set(dataset
          .filter(d => chosenAssetTypes.includes(d.assetType))
          .map(d => d.groupingID)
        )

        state.highlighted_ids = filtered
        updateOnInput()

      } else { // everything is unticked => show all

        state.highlighted_ids = new Set(dataset.map(d => d.groupingID))
        updateOnInput()

      }

    })

  const yearsList = d3.select('div#vis')
    .append('ul')
      .classed('years', true)

  const years = new Set(dataset.map(d => d.periodLength))

  // TODO refactor below in d3's declarative way instead of procedural
  years.forEach((i) => {
    yearsList
      .append('li')
        .append('label')
          .text(`${i} years`)
          .append('input')
            .attr('type', 'radio')
            .attr('name', 'years')
            .attr('value', i)
            .classed(`y${i}`, true)
  })

  yearsList.select(`input.y${defaultPeriodLength}`)
    .attr('checked', true)

  yearsList.selectAll('input[type=radio]')
    .on('change', function(event) {

      updateSliderPeriodLine()
      updateOnInput()

    })

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
      // leave space for datapoints at 0% volatility, right at the edge
      .attr('width', width+10)
      .attr('height', height)
      .attr('x', 0-10)
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
  // SLIDER
  //

  const slider = d3.sliderBottom()
    .min(d3.min(dataset, d => d.periodStart ))
    .max(d3.max(dataset, d => d.periodEnd ))
    .width(sliderWidth)
    .fill('#ffb600')
    .ticks(8)
    .tickFormat(d3.timeFormat('%Y'))
    //.displayFormat(d3.timeFormat('%Y %b %d'))
    .default(sliderValueAtPageLoad)
    .on('start', function(sliderValue) {
      // TODO there's some weird lag where the user must click twice

      stopAnimation()

    })
    .on('onchange', function(sliderValue) {

      updateSliderPeriodLine()
      updateOnInput()

    })

  const sliderElement = svg
    .append('g')
      .attr('id', 'slider')
      .attr('transform', 'translate(' + (totalWidth - sliderWidth - margin.right - 10 - spaceForPlayButton) + ',' + 10 + ')')
      .call(slider)

  const originalSliderLine = sliderElement.select('line.track-fill')

  const sliderScale = d3.scaleTime()
    .domain(slider.domain())
    .range([0, sliderWidth])
    .nice()

  const sliderPeriodLine = sliderElement.select('g.slider')
    .append('line')
      .classed('track-fill', true)
      .classed('fixed-period', true)

  const playButtonText = '◀'
  const pauseButtonText = '❚❚'

  const playButton = svg.select('g#slider')
    .append('text')
      .attr('id', 'play-button')
      .classed('button', true)
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

  updateSliderPeriodLine()

  //
  // ZOOM via BRUSH
  //

  // followed this example: https://bl.ocks.org/mbostock/f48fcdb929a620ed97877e4678ab15e6

  var idleTimeout
  const idleDelay = 350

  const brush = d3.brush()
    .on('end', (event) => {

      const s = event.selection

      if (!s) {

        // this controls returning to starting zoom level on double click

        if (!idleTimeout) {
          return idleTimeout = setTimeout(() => { idleTimeout = null }, idleDelay)
        }

        var xDomainNew = xDomainDefault
        var yDomainNew = yDomainDefault

      } else {

        var xDomainNew = [ s[0][0], s[1][0] ].map(xScale.invert, xScale)
        var yDomainNew = [ s[1][1], s[0][1] ].map(yScale.invert, yScale)

        innerChart.call(brush.move, null)

      }

      zoom(xDomainNew, yDomainNew)

    })

  function zoom(xDomain, yDomain) {

    xScale.domain(xDomain)
    yScale.domain(yDomain)

    updateOnInput()

    const t = svg.transition().duration(timingDotMovement)
    xAxisElement.transition(t).call(xAxis)
    xGridElement.transition(t).call(xGrid)
    yAxisElement.transition(t).call(yAxis)
    yGridElement.transition(t).call(yGrid)

  }

  svg // reset zoom button
    .append('text')
      .attr('id', 'reset-zoom')
      .classed('button', true)
      .text('reset zoom')
      .attr('transform', `translate(${margin.left + width - 80}, ${margin.top + 20})`)
      .on('click', (event) => { zoom(xDomainDefault, yDomainDefault) })

  enableZoom()

  //
  // DRAW DATA
  //

  updateOnInput()

  //
  // HELPER FUNCTIONS
  //

  function groupby(d) { return d.name }
  function extractFirstItem(group) { return group[0] }

  function updateOnInput() {

    // the default is to show what is already there
    const selected_ids = state.selected_ids || null
    const selectedPeriodLength = state.selected_period_length || getSelectedPeriodLength()
    const highlighted_ids = state.highlighted_ids || new Set(dataset.map(d => d.groupingID))
    const sliderValues = state.slider || [ getSliderValuePeriodStart(), slider.value() ]

    const dots_are_selected = selected_ids !== null

    // TODO cleaner to have a scoped dataset inside here (?)
    // reset state
    dataset
      .forEach(i => {
        i.selected = false
        i.background = false
      })

    // TODO ohh the whole trail is redrawn each time ! hence the un-smoothness of transitions
    d3.selectAll('.trail')
      .remove()

    var dataToShow = dataset
      .filter(d => d.groupingID == selected_ids || d.source == 'share')
      .filter(d => highlighted_ids.has(d.groupingID))
      .filter(d => d.periodLength == selectedPeriodLength)
      .filter(d => (d3.timeWeek.offset(sliderValues[1], -2) < d.periodEnd) && (d.periodEnd < d3.timeWeek.offset(sliderValues[1], +2)))

    var dataToShow = Array.from(d3
      .rollup(dataToShow, extractFirstItem, groupby)
      .values()
      )

    if (dots_are_selected) {

      dataToShow.filter(d => d.groupingID == selected_ids)
        .forEach(i => i.selected = true)

      dataToShow.filter(d => d.groupingID !== selected_ids)
        .forEach(i => i.background = true)

    }

    drawTrail(selected_ids)
    drawData(dataToShow)

  }

  function drawData(dataset) {

    innerChart.selectAll('path.symbol')
      .data(dataset, d => d.mstarcode + d.periodLength)
      .join(selectionEnter, selectionUpdate, selectionExit)

  }

  function selectionEnter(selection) {

    const dots = selection
      .append('path')

    dots
      .attr('d', d => d3.symbol().type( shapeScale(d.source) ).size(1)())
      .attr('class', d => d.assetType)
      .classed('symbol', true) // TODO find out why this needs to be placed after the previous lines
      .classed('selected', d => d.selected)
      .classed('background', d => d.background)
      .classed('peers', d => d.peers)
      .classed('benchmark', d => d.benchmark)
      .call(positionDot)
      .call(dotStyling)
      .on('click', (event, d) => {
        // TODO factor out A. when a new selected group is drawn, B. when group is de-selected

        // all other circles must return to original size
        // TODO fix bug: maybe this is causing a glitch
        dots
          .attr('d', d => d3.symbol().type( shapeScale(d.source) ).size(shapeSizeDefault)())
          .transition()
            .duration(200)
            .style('opacity', 0.1)

        let thisDot = d3.select(event.target)

        thisDot
          .attr('d', d => d3.symbol().type( shapeScale(d.source) ).size(shapeSizeFocused)())
          .raise()

        state.selected_ids = d.groupingID
        updateOnInput()


      })
      .on('mouseover', (event, d) => {

        const dot = d3.select(event.target)
        dot.raise()

        dot
          .transition()
            .duration(300)
            .style('opacity', 1)
            .attr('d', d => d3.symbol().type( shapeScale(d.source) ).size(shapeSizeFocused)())
          .on('end', () => { d3.select(this).classed('background', false) })

        // draw the focus line

        const xPos = xScale(d.volatility)
        const yPos = yScale(d.performance)

        focus
          .style('display', null)

        focus.select('line.vertical')
          .attr('transform', `translate(${xPos}, ${0})`)
          .attr('y1', yPos)

        focus.select('line.horizontal')
          .attr('transform', `translate(${0}, ${yPos})`)
          .attr('x2', xPos)

      })
      .on('mouseout', (event, d) => {

        const dot = d3.select(event.target)
        const dots_are_selected_but_not_this_dot = state.selected_ids && !dot.classed('selected')
        // this distinction is important because of the state where nothing is selected, you don't want dots going into background mode

        if (dots_are_selected_but_not_this_dot) {

          dot
            .transition()
              .duration(400)
              .style('opacity', 0.1)
            .on('end', () => { d3.select(this).classed('background', true) })

          d3.select('text.fund-name').text('')

        }

        if (!dot.classed('selected')) {

          dot
            .transition()
              .duration(400)
              .attr('d', d => d3.symbol().type( shapeScale(d.source) ).size(shapeSizeDefault)())

        } else {

          dot
            .transition()
              .duration(400)
              .attr('d', d => d3.symbol().type( shapeScale(d.source) ).size(shapeSizeSelected)())

        }

        d3.select('g.focus')
          .style('display', 'none')

      })

    dots
      .transition()
        .delay(0)
        .duration(150)
        .ease(d3.easeLinear)
        .attr('d', d => d3.symbol().type( shapeScale(d.source) ).size( sizeScale(d.selected.toString()) )() )

    dots.append('title')
      .classed('tooltip', true)
      .text(tooltipText)

  }

  function selectionUpdate(selection) {

    selection
      .call(dotStyling)
      .transition()
        .duration(timingDotMovement)
        .ease(d3.easeLinear)
        .call(positionDot)
        .attr('d', d => d3.symbol().type( shapeScale(d.source) ).size(shapeSizeDefault)())
      .on('end', () => {
        d3.select(this)
          .classed('selected', d => d.selected)
          .classed('background', d => d.background)
      })

    d3.selectAll('title.tooltip')
      .remove()

    d3.selectAll('path.symbol')
      .append('title')
        .classed('tooltip', true)
        .text(tooltipText)

  }

  function selectionExit(selection) {

    selection
      .transition()
        .delay(0)
        .duration(100)
        .ease(d3.easeLinear)
        .attr('d', d => d3.symbol().type( shapeScale(d.source) ).size(1)())
        .style('fill-opacity', 0)
        .style('opacity', 0)
      .remove()

  }

  function positionDot(selection) {

    selection
      .attr('transform', d => `translate(${xScale(d.volatility)}, ${yScale(d.performance)})`)

  }

  function dotStyling(dots) {

    dots
      .style('fill-opacity', 1)

  }

  function drawTrail(groupingID) {
    // TODO it seems more logical for the trail to be linked to mstarcode

    const selectedPeriodLength = state.selected_period_length || getSelectedPeriodLength()
    const sliderValues = state.slider || [ getSliderValuePeriodStart(), slider.value() ]

    const trailData = dataset
      .filter(d => d.groupingID == groupingID && d.source == 'share')
      .filter(d => d.periodLength == selectedPeriodLength)
      .filter(d => d.periodEnd > d3.timeWeek.offset(sliderValues[1], -2))

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

    d3.selectAll('path.symbol')
      .raise()

  }

  function animateThroughTime() {

    playButton.text(pauseButtonText)
    disableZoom()

    // TODO ideally this zoom transition would be done at the same time in one smooth movement, overlapping with the historical animation start
    zoom(xDomainDefault, yDomainDefault)

    svg.transition()
      .delay(200)
      .duration(50000) // msec
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
        enableZoom()

      })

  }

  function stopAnimation() {

    // stop animation
    svg.transition().duration(0)

    enableZoom()
    playButton.text(playButtonText)

  }

  function disableZoom() { innerChart.on('.brush', null) }
  function enableZoom() { innerChart.call(brush) }

  function tooltipText(d) {

    const text = ''
             + '\nname: ' + d.name
             + '\nISIN code: ' + d.isin
             + '\nmstarcode: ' + d.mstarcode
             + '\nsource: ' + d.source
             + '\nasset type: ' + d.assetType
             + '\nstart date: ' + d3.timeFormat('%Y %b %d')(d.periodStart)
             + '\nend date: ' + d3.timeFormat('%Y %b %d')(d.periodEnd)
             + '\nperiod length: ' + d.periodLength + ' years'
             + '\nperformance: ' + (d.performance * 100).toFixed(1) + '%'
             + '\nvolatility: ' + (d.volatility * 100).toFixed(1) + '%'
    return text

  }

  function getSelectedPeriodLength() {

    const numYears = parseInt(d3.select('ul.years input[type=radio]:checked').property('value'))
    return numYears

  }

  function getSliderValuePeriodStart() {

    const numYears = getSelectedPeriodLength()
    const periodEndDate = slider.value()
    const periodStartDate = d3.timeYear.offset(periodEndDate, -numYears)

    return periodStartDate

  }

  function updateSliderPeriodLine() {

    const periodStartDate = getSliderValuePeriodStart()

    const x1 = sliderScale(periodStartDate)
    const x2 = originalSliderLine.attr('x2')

    sliderPeriodLine
      .attr('x1', x1)
      .attr('x2', x2)

  }

}

// TODO bug: if animation is in place and i mouseover a dot it doesn't come out of background, and if i click on a dot it is selected but doesn't come out of focused selected size (ie stays big size as if mouseout event wasn't triggered)

