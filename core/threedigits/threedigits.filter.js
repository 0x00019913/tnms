angular.module('core', []).filter('threedigits', function() {
  return function(input) {
    if (input>=0) {
      if (input>999) return '999';
      return ('000'+input).slice(-3);
    }
    else {
      if (input<-99) return '-99';
      return '-' + ('000'+(-input)).slice(-2);
    }
  };
});
