// prevent right-click menu the AngularJSy way
angular.module("board").directive("ngRightClick", function($parse) {
  return function(scope, element, attrs) {
    element.bind('contextmenu', function(event) {
      scope.$apply(function() {
        event.preventDefault();
      })
    });
  };
});
