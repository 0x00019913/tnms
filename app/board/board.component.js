'use strict';

/* board controller */
/*
  contains rows of cells
  cell properties are as follows:
    open (false): true if has been clicked, else false
    content (0):
      0 if no mine and neighboring cells have no mines
      1-8 if neighboring cells contain 1-8 mines
      9 if mine
*/


angular.module("board").component("board", {
  templateUrl: "board/board.template.html",
  controller: function BoardController() {
    /* BASIC PARAMS */
    this.w = 30;    // width
    this.h = 16;    // height
    this.n = 99;    // number of mines
    this.map = [];  // map of the board; array of rows of cells
    /* GAME STATE
      0: uninitialized board, all cells closed
      1: game in progress - at least one cell is open
      2: game won - every cell not containing a mine is open
      3: game lost - at least one cell containing a mine is open
    */
    this.state = 0;
    /* HANDLING MOUSE */
    this.mousedown = false;
    /* COLOR PRESETS */
    this.topcolor = [0x1e, 0x3f, 0x70];
    this.botcolor = [0x58, 0x90, 0xb6];
    this.highlightColor = [0x1a, 0x1a, 0x1a];

    /* CELL COLOR UTILS */

    // returns a color interpolated between .topcolor and .botcolor by
    // parameter t; t is assumed normalized on [0,1]
    // returns rgb string starting with '#'
    this.rgbLerp = function rgbLerp(t) {
      var tc = this.topcolor;
      var bc = this.botcolor;
      var c = [];
      for (var i=0; i<3; i++) {
        c.push(Math.round((tc[i]*t + bc[i]*(1-t))));
      }
      return c;
    };
    // turns an array of 3 ints into a hex color string
    this.colorToHexStr = function colorToHexStr(c) {
      var result = "#";
      for (var i=0; i<3; i++) {
        var val = c[i].toString(16);
        if (val.length==1) val = "0" + val;
        result += val;
      }
      return result;
    }

    // the internal color on a cell is an array of 3 ints; these are the cell's
    // *true* color with no highlighting
    // the cell.color property is a hex string representing the current color;
    // we may add or subtract our highlight color from this to highlight or
    // unhighlight

    // add two internal colors
    this.addColor = function addColor(a, b) {
      var result = [];
      for (var i=0; i<3; i++) result.push(a[i] + b[i]);
      return result;
    };
    // subtract two internals colors
    this.subColor = function subColor(a, b) {
      var result = [];
      for (var i=0; i<3; i++) result.push(a[i] - b[i]);
      return result;
    };
    // make cell's color its internal color plus highlight color
    this.highlightCell = function highlightCell(cell) {
      var c = this.addColor(cell.colorInternal.slice(), this.highlightColor);
      cell.color = this.colorToHexStr(c);
    };
    // make cell's color its internal color minus highlight color
    this.unhighlightCell = function unhighlightCell(cell) {
      var c = this.subColor(cell.colorInternal.slice(), this.highlightColor);
      cell.color = this.colorToHexStr(c);
    };
    // reset cell's color to its internal color
    this.resetCellColor = function resetCellColor(cell) {
      cell.color = this.colorToHexStr(cell.colorInternal);
    };

    // mouse handlers
    this.onMouseover = function onMouseover(cell, e) {
      if (e.which==1) this.unhighlightCell(cell);
      else this.highlightCell(cell);
    };
    this.onMouseout = function onMouseout(cell, e) {
      this.resetCellColor(cell);
    };
    this.onMousedown = function onMousedown(cell, e) {
      this.unhighlightCell(cell);
    };
    this.onMouseup = function onMouseup(cell, e) {
      this.highlightCell(cell);
    };

    /* SETUP AND INITIALIZATION */

    this.init = function init() {
      // build board
      for (var r=0; r<this.h; r++) {
        var row = [];
        for (var c=0; c<this.w; c++) {
          var colorInternal = this.rgbLerp(r/this.h);
          row.push({
            open: false,
            content: 0,
            flag: false,
            y: r,
            x: c,
            colorInternal: colorInternal,
            color: this.colorToHexStr(colorInternal)
          });
        }
        this.map.push(row);
      }
    };

    // random integer between 0 and mx, inclusive
    this.randint = function randint(mx) {
      return Math.floor(Math.random()*mx);
    };

    // applies a function to the neighbors of cell (y,x)
    // function f takes two arguments:
    this.mapToNeighbors = function mapToNeighbors(y, x, f) {
      var h = this.h;
      var w = this.w;
      for (var i=y-1; i<=y+1; i++) {
        if (i<0 || i>=h) continue;

        for (var j=x-1; j<=x+1; j++) {
          if (j<0 || j>=w) continue;

          f(i,j);
        }
      }
    };

    // reset board to all 0s and closed cells
    this.resetBoard = function resetBoard() {
      for (var y=0; y<this.h; y++) {
        for (var x=0; x<this.w; x++) {
          var cell = this.map[y][x];
          cell.open = false;
          cell.content = 0;
        }
      }
    }

    // make a new game
    // if params given, they indicate a cell which must not contain a mine b/c
    // the player clicked there to start the game
    this.generateGame = function generateGame(ycl, xcl) {
      // place mines
      for (var n=0; n<this.n; n++) {
        var x,y;
        do {
          x = this.randint(this.w);
          y = this.randint(this.h);
        } while (this.map[y][x].content==9 || (y==ycl && x==xcl));
        var cell = this.map[y][x];
        cell.content = 9;

        // update the contents of neighboring cells
        var _this = this;
        this.mapToNeighbors(y, x, function(yy,xx) {
          var c = _this.map[yy][xx];
          if (c.content<9) c.content += 1;
        });
      }
    };

    this.init();
    this.generateGame();
  }
});
