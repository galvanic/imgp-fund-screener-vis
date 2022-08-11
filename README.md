Overview Fund Screener
===

*   demo hosted online at: [https://bl.ocks.org/galvanic/raw/545ad08a93ae86f3ffa1612a2df47696/](https://bl.ocks.org/galvanic/raw/545ad08a93ae86f3ffa1612a2df47696/)
*   code hosted online at: [https://github.com/galvanic/imgp-fund-screener-vis](https://github.com/galvanic/imgp-fund-screener-vis)


Project Aim
-----------

The application is a plot of performance data representing the firm funds over different time periods, for a viewer and potential customer to make more educated choices.
The desired outcome for the project changed during its lifetime: it started with an animated plot with limited interactivity in order to show on the main page of the website.
The new aim is to develop a more interactive application that would be reached on another page via a link on the website main page.

We were inspired by this visualisation: [https://observablehq.com/@mbostock/the-wealth-health-of-nations](https://observablehq.com/@mbostock/the-wealth-health-of-nations)


Features
--------

*   Filtering performance data over 1-3-5Y periods, back in time - via the slider & option list
*   Filtering funds according to asset type & ESG - via multiple choice & radio lists
*   On hover:
    *   tooltip gives an overview of the fund
    *   '+' sign indicates that there is more information to display on a fund
*   On click, isolate the fund via an overlay and display extra information:
    *   benchmark & peer data for that fund
    *   further overview of the fund with link to more information
    *   historical trace data for that fund
*   Zoom: the user can click & drag to zoom into specific areas of the plot and see the data more clearly. Double click brings the zoom level back to beginning
*   Animation: when clicking on the play button on the side of the slider, the data plays back performance over time


User Interface
--------------

See [https://xd.adobe.com/view/d395db97-5afc-48c8-b50f-95e2edeb5139-86c6/specs/](https://xd.adobe.com/view/d395db97-5afc-48c8-b50f-95e2edeb5139-86c6/specs/)


Technology & Frameworks Used
----------------------------


#### Javascript application

The application is built in javascript with **D3.js** ([https://d3js.org/](https://d3js.org/)) as the main framework. D3 has a declarative approach to displaying data: the programmer only needs to describe how the data looks when it "enters", "updates" or "exits" the scene, and D3 takes care of displaying, animating, etc.
The latest D3 version 7 is used.


#### Python for data processing

The pipeline includes a **python script** to transform the data. The pipeline (ie. the hooking) is not yet built (see "Next Steps" below) and my understanding is that it will be set to run automatically when the new weekly data is received.

The python script can be viewed here: [https://github.com/galvanic/imgp-fund-screener-vis/blob/main/process.py](https://github.com/galvanic/imgp-fund-screener-vis/blob/main/process.py)
The python script is run in the command line as such:

```bash
$ python3 process.py "iMGP Funds Report New_DDMMYYYY.xlsx" > dataset.csv
```

The script prints to `stdout` the data in csv format, with the column names included. This output can then be redirected using `>` operator to create a file named `dataset.csv` as expected
See below for more details on expected inputs and outputs.


#### Application file organisation


```plain
.
├── d3.min.js
├── d3-simple-slider.min.js
├── dataset_Y135.csv
├── index.html
├── main.js
├── README.md
└── style.css
```

The following are framework dependencies: **d3.min.js** and **d3-simple-slider.min.js**.
The dataset output by the python script is **dataset\_Y135.csv** and is called by **main.js**.
The application lives inside **main.js**.
Some styling is inside **style.css**. Styling that involves transitions / animations via javascript are directly encoded in the **main.js**.
**index.html** brings together the dependencies, javascript and CSS.


Pipeline
--------


#### Overview

The data is retrieved weekly via Morningstar in the form of an Excel spreadsheet. A Python script processes the data and saves it to a CSV file which is read by the JavaScript application.


#### Input Outputs

1.  Weekly on Tuesday, Morningstar sends an Excel spreadsheet **via email** with the subject line "Morningstar Performance Reporting batch \[Performance Reporting Website\] has finished."

The file is called `iMGP Funds Report New\_DDMMYYYY.xlsx` with `DDMMYYYY` replaced by actual date.

3.  There exists a python script that transforms this data into a csv file read by the application.

The python script takes as **input**:
*   the above mentioned weekly **excel file**
*   the existing past historical performance data **csv file**
*   some metadata files (to be added, for ESG and tooltip / fund overview extra information)

The python script produces as **output**:

*   a **csv file** with all the data needed by the application


Next Steps
----------


#### todo

*   Finish implementing given UI changes


#### Hosting & Pipeline

At the moment, the application is hosted via the free hosting service for D3 related apps, [bl.ocks.org](http://bl.ocks.org).
The application needs to be hosted on a private server.

The pipeline needs to be built by hooking up the data sources, the python script and the application together.
At the moment, the data pipeline does not take into account new data arriving weekly; the python script just takes a historic data file and adds data from a weekly report excel file to it. Ideally, the pipeline would treat the historic data file as a database of sorts and append the weekly data to it weekly, altering the historic data file - or just simply implement an actual database, depending on needs.


#### Joining data from other sources

*   ESG status: we do not have that data directly in the Morningstar data, so it would have to be joined during the python script processing step
*   Tooltip and fund overview information. Needs to be retrieved in centralised
*   Key dates in the slider


#### Handling missing data in the UI

There are missing data points, especially as we go back in time. There needs to be a UI proposal for letting the user know that the data does not exist for that fund at the selected time period, and that it is not an error on their part.


#### Extra functionality ?

*   Currency data: At the moment, we only show one currency per share class. If we wanted to give this extra information to the user, what is the UI/UX to show this ?
*   Search for funds via ISIN text search box ?


This calls for a bigger decision around whether this application would replace, or integrate more fluidly, with the existing fund screening website page, where funds are displayed in a table manner and are searched via text.
