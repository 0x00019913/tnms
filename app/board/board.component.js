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
  controller: ["$interval", function BoardController($interval) {
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
    /* VICTORY CONDITIONS
      the number of cells the player needs to open to win and a count of cells
      currently open/flagged
    */
    this.targetCount = this.w*this.h - this.n;
    this.openCount = 0;
    this.flagCount = 0;
    /* COLOR PRESETS */
    this.topcolor = [0x1e, 0x3f, 0x70];
    this.botcolor = [0x58, 0x90, 0xb6];
    /* TIMER */
    this.timer = null;
    this.time = 0;

    var _this = this;

    /* CELL COLOR UTILS */

    // returns a color interpolated between .topcolor and .botcolor by
    // parameter t; t is assumed normalized on [0,1]
    // returns array of 3 ints [r, g, b]
    function rgbLerp(t) {
      var tc = _this.topcolor;
      var bc = _this.botcolor;
      var c = [];
      for (var i=0; i<3; i++) {
        c.push(Math.round((tc[i]*t + bc[i]*(1-t))));
      }
      return c;
    };
    // turns an array of 3 ints into a hex color string
    function colorToHexStr(c) {
      var result = "#";
      for (var i=0; i<3; i++) {
        var val = c[i].toString(16);
        if (val.length==1) val = "0" + val;
        result += val;
      }
      return result;
    }

    // mouse handlers
    this.cellMousedown = function cellMousedown(cell, e) {
      if (this.state>1) return; // no action if game won/lost

      if (e.which==3) this.rightClickCell(cell);
    };
    this.cellMouseup = function cellMouseup(cell, e) {
      if (this.state>1) return; // no action if game won/lost

      // if we released a button while having another depressed, do the
      // neighbor reveal for the player's convenience
      if (e.buttons>0) this.revealNeighbors(cell);
      // if we just unclicked the primary button, simply consider the cell
      // clicked
      else if (e.which==1) this.clickCell(cell);
    };
    this.cellDoubleclick = function cellDoubleclick(cell, e) {
      if (this.state>1) return; // no action if game won/lost

      // neighbor reveal also triggered by double click
      this.revealNeighbors(cell);
    }

    /* SETUP AND INITIALIZATION */

    // called once at the start; creates the empty closed cells
    this.init = function init() {
      // build board
      for (var r=0; r<this.h; r++) {
        var row = [];
        var colorInternal = rgbLerp(r/this.h);
        for (var c=0; c<this.w; c++) {
          row.push({
            open: false,
            content: 0,
            flag: false,
            y: r,
            x: c,
            color: colorToHexStr(colorInternal)
          });
        }
        this.map.push(row);
      }
    };

    // random integer between 0 and mx, inclusive
    function randint(mx) {
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
      stopTimer();
      this.time = 0;
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
          x = randint(this.w);
          y = randint(this.h);
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
    };

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
        // start the timer
        startTimer();
      }
      else if (this.state==1) {
        this.reveal(cell);
      }
    };

    function startTimer() {
      _this.timer = $interval(function() {
        _this.time += 1;
      },
      1000);
    }
    function stopTimer() {
      if (angular.isDefined(_this.timer)) $interval.cancel(_this.timer);
    }

    // handle right click on a cell
    this.rightClickCell = function rightClickCell(cell) {
      if (cell.open) return;

      cell.flag = !cell.flag;
      if (cell.flag) this.flagCount++;
      else this.flagCount--;
    };

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

      if (flagCount==cell.content) {
        this.mapToNeighbors(cell, function(c) {
          if (!c.flag) _this.reveal(c);
        });
      }
    };

    this.reveal = function reveal(cell) {
      // if cell is already open, return
      if (cell.open || cell.flag) return;

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
    };

    // player stepped on a mine - update game state and reveal all mines
    this.loseGame = function loseGame() {
      // mark game state as lost
      this.state = 2;
      console.log("lose", this.state);

      stopTimer();

      // reveal all mines
      for (var y=0; y<this.h; y++) {
        for (var x=0; x<this.w; x++) {
          var cell = this.map[y][x];
          if (cell.content==9) this.openCell(cell);
        }
      }
    };

    // player opened all cells that
    this.winGame = function winGame() {
      // mark game state as won
      this.state = 3;
      console.log("win", this.state);

      stopTimer();
    };

    this.init();
  }]
});
