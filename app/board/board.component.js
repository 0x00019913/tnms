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
    /*  VICTORY CONDITIONS
      the number of cells the player needs to open to win
    */
    this.targetCount = this.w*this.h - this.n;
    this.openCount = 0;
    // used for the flag counter
    this.flagCount = 0;
    /* HANDLING MOUSE */
    this.mousedownCount = 0;
    /* COLOR PRESETS */
    this.topcolor = [0x1e, 0x3f, 0x70];
    this.botcolor = [0x58, 0x90, 0xb6];
    this.highlightColor = [0x11, 0x11, 0x11];

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
    this.boardMouseover = function boardMouseover(e) {
      if (this.state>1) return; // no action if game won/lost

      if (e.which) this.mousedownCount++;
    }
    this.boardMouseout = function boardMouseout(e) {
      if (this.state>1) return; // no action if game won/lost

      if (e.which) this.mousedownCount--;
    }
    this.onMouseover = function onMouseover(cell, e) {
      if (this.state>1) return; // no action if game won/lost

      if (!e.which) this.mousedownCount = 0;
      if (e.which==1) this.unhighlightCell(cell);
      else this.highlightCell(cell);
    };
    this.onMouseout = function onMouseout(cell, e) {
      if (this.state>1) return; // no action if game won/lost

      this.resetCellColor(cell);
    };
    this.onMousedown = function onMousedown(cell, e) {
      if (this.state>1) return; // no action if game won/lost

      this.mousedownCount++;

      this.unhighlightCell(cell);
    };
    this.onMouseup = function onMouseup(cell, e) {
      if (this.state>1) return; // no action if game won/lost

      if (this.mousedownCount==2) this.revealNeighbors(cell);
      this.mousedownCount--;

      this.resetCellColor(cell);

      if (e.which==1) this.clickCell(cell);
      else if (e.which==3) this.rightClickCell(cell);
    };
    this.onDoubleclick = function onDoubleclick(cell, e) {
      if (this.state>1) return; // no action if game won/lost

      this.revealNeighbors(cell);
    }

    /* SETUP AND INITIALIZATION */

    // called once at the start; creates the empty closed cells
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

    // applies a function to the neighbors of the given cell;
    // function f takes one argument: the neighbor cell
    this.mapToNeighbors = function mapToNeighbors(cell, f) {
      var y = cell.y;
      var x = cell.x;
      for (var i=y-1; i<=y+1; i++) {
        if (i<0 || i>=this.h) continue;

        for (var j=x-1; j<=x+1; j++) {
          if (j<0 || j>=this.w) continue;

          if (i==y && j==x) continue;

          f(this.map[i][j]);
        }
      }
    };

    // reset board to all 0s and closed cells
    this.reset = function reset() {
      this.state = 0;
      for (var y=0; y<this.h; y++) {
        for (var x=0; x<this.w; x++) {
          var cell = this.map[y][x];
          cell.open = false;
          cell.content = 0;
          cell.flag = false;
        }
      }
      this.flagCount = 0;
      this.openCount = 0;
    }

    // make a new game
    // if params given, they indicate a cell which must not contain a mine b/c
    // the player clicked there to start the game
    this.generateGame = function generateGame(ycl, xcl) {
      // place mines
      for (var n=0; n<this.n; n++) {
        var x,y;
        var invalid;
        do {
          x = this.randint(this.w);
          y = this.randint(this.h);
          invalid = this.map[y][x].content==9 || (Math.abs(y-ycl)<2 && Math.abs(x-xcl)<2);
        } while (invalid);
        var cell = this.map[y][x];
        cell.content = 9;

        // update the contents of neighboring cells
        this.mapToNeighbors(cell, function(c) {
          if (c.content<9) c.content += 1;
        });
      }

      this.openCount = 0;
    };

    /* HANDLING CLICKS AND REVEALING THE BOARD */

    this.openCell = function openCell(cell) {
      cell.open = true;
      cell.flag = false;
      this.openCount++;

      // if we've opened the requisite number of cells, victory!
      if (this.openCount==this.targetCount) {
        this.winGame();
      }
    }

    // called from the mouse event handlers; this happens after a mouseup event
    // on a cell - click a cell and modify game state and board visibility
    // appropriately
    this.clickCell = function clickCell(cell) {
      // no-op if cell is flagged
      if (cell.flag) return;

      // state 0: uninitialized, fully closed board
      // generate a game (in such a way that we don't land on a mine
      // immediately), reveal the clicked cell, update game state to 1
      if (this.state==0) {
        // crate the contents of the board
        this.generateGame(cell.y, cell.x);
        // reveal where we clicked
        this.reveal(cell);
        // update state to 1 (in progress)
        this.state = 1;
      }
      else if (this.state==1) {
        this.reveal(cell);
      }
    }

    // handle right click on a cell
    this.rightClickCell = function rightClickCell(cell) {
      if (cell.open) return;

      cell.flag = !cell.flag;
      if (cell.flag) this.flagCount++;
      else this.flagCount--;
    }

    // invoked on an open number cell by:
    //  double-clicking, or
    //  holding two mouse buttons and then releasing one
    // if we've flagged exactly as many cells around a cell as there
    // are mines, we can reveal its neighbors that are not flagged
    this.revealNeighbors = function revealNeighbors(cell) {
      // if cell is closed or contains nothing, we don't need to do anything
      if (!cell.open || cell.content==0) return;

      // get the count of flags around the cell
      var flagCount = 0;
      this.mapToNeighbors(cell, function(c) {
        if (c.flag) flagCount++;
      });

      var _this = this;
      if (flagCount==cell.content) {
        this.mapToNeighbors(cell, function(c) {
          if (!c.flag) _this.reveal(c);
        });
      }
    }

    this.reveal = function reveal(cell) {
      // if cell is already open, return
      if (cell.open || cell.flag) return;

      var _this = this;
      // cell contains mine; lose the game here and do nothing else
      if (cell.content==9) {
        this.loseGame();
      }
      // if cell contains number (not a mine), just open it
      else if (cell.content>0) {
        this.openCell(cell);
      }
      // if empty cell, recurse to its neighbors
      if (cell.content==0) {
        // open the current cell
        this.openCell(cell);
        // and reveal its neighbors
        this.mapToNeighbors(cell, function(c) {
          if (c.content<9) _this.reveal(c);
        });
      }
    }

    // player stepped on a mine - update game state and reveal all mines
    this.loseGame = function loseGame() {
      // mark game state as lost
      this.state = 2;

      // reveal all mines
      for (var y=0; y<this.h; y++) {
        for (var x=0; x<this.w; x++) {
          var cell = this.map[y][x];
          if (cell.content==9) this.openCell(cell);
        }
      }
    }

    // player opened all cells that
    this.winGame = function winGame() {
      // mark game state as won
      this.state = 3;
    }

    this.init();
  }
});
