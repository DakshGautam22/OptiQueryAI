"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/crelt";
exports.ids = ["vendor-chunks/crelt"];
exports.modules = {

/***/ "(ssr)/./node_modules/crelt/index.js":
/*!*************************************!*\
  !*** ./node_modules/crelt/index.js ***!
  \*************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (/* binding */ crelt)\n/* harmony export */ });\nfunction crelt() {\n  var elt = arguments[0]\n  if (typeof elt == \"string\") elt = document.createElement(elt)\n  var i = 1, next = arguments[1]\n  if (next && typeof next == \"object\" && next.nodeType == null && !Array.isArray(next)) {\n    for (var name in next) if (Object.prototype.hasOwnProperty.call(next, name)) {\n      var value = next[name]\n      if (typeof value == \"string\") elt.setAttribute(name, value)\n      else if (value != null) elt[name] = value\n    }\n    i++\n  }\n  for (; i < arguments.length; i++) add(elt, arguments[i])\n  return elt\n}\n\nfunction add(elt, child) {\n  if (typeof child == \"string\") {\n    elt.appendChild(document.createTextNode(child))\n  } else if (child == null) {\n  } else if (child.nodeType != null) {\n    elt.appendChild(child)\n  } else if (Array.isArray(child)) {\n    for (var i = 0; i < child.length; i++) add(elt, child[i])\n  } else {\n    throw new RangeError(\"Unsupported child node: \" + child)\n  }\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvY3JlbHQvaW5kZXguanMiLCJtYXBwaW5ncyI6Ijs7OztBQUFlO0FBQ2Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVMsc0JBQXNCO0FBQy9CO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsSUFBSTtBQUNKLElBQUk7QUFDSjtBQUNBLElBQUk7QUFDSixvQkFBb0Isa0JBQWtCO0FBQ3RDLElBQUk7QUFDSjtBQUNBO0FBQ0EiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly9vcHRpcXVlcnktYWktZnJvbnRlbmQvLi9ub2RlX21vZHVsZXMvY3JlbHQvaW5kZXguanM/NzUzMyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBjcmVsdCgpIHtcbiAgdmFyIGVsdCA9IGFyZ3VtZW50c1swXVxuICBpZiAodHlwZW9mIGVsdCA9PSBcInN0cmluZ1wiKSBlbHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KGVsdClcbiAgdmFyIGkgPSAxLCBuZXh0ID0gYXJndW1lbnRzWzFdXG4gIGlmIChuZXh0ICYmIHR5cGVvZiBuZXh0ID09IFwib2JqZWN0XCIgJiYgbmV4dC5ub2RlVHlwZSA9PSBudWxsICYmICFBcnJheS5pc0FycmF5KG5leHQpKSB7XG4gICAgZm9yICh2YXIgbmFtZSBpbiBuZXh0KSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG5leHQsIG5hbWUpKSB7XG4gICAgICB2YXIgdmFsdWUgPSBuZXh0W25hbWVdXG4gICAgICBpZiAodHlwZW9mIHZhbHVlID09IFwic3RyaW5nXCIpIGVsdC5zZXRBdHRyaWJ1dGUobmFtZSwgdmFsdWUpXG4gICAgICBlbHNlIGlmICh2YWx1ZSAhPSBudWxsKSBlbHRbbmFtZV0gPSB2YWx1ZVxuICAgIH1cbiAgICBpKytcbiAgfVxuICBmb3IgKDsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykgYWRkKGVsdCwgYXJndW1lbnRzW2ldKVxuICByZXR1cm4gZWx0XG59XG5cbmZ1bmN0aW9uIGFkZChlbHQsIGNoaWxkKSB7XG4gIGlmICh0eXBlb2YgY2hpbGQgPT0gXCJzdHJpbmdcIikge1xuICAgIGVsdC5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjaGlsZCkpXG4gIH0gZWxzZSBpZiAoY2hpbGQgPT0gbnVsbCkge1xuICB9IGVsc2UgaWYgKGNoaWxkLm5vZGVUeXBlICE9IG51bGwpIHtcbiAgICBlbHQuYXBwZW5kQ2hpbGQoY2hpbGQpXG4gIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShjaGlsZCkpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNoaWxkLmxlbmd0aDsgaSsrKSBhZGQoZWx0LCBjaGlsZFtpXSlcbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIlVuc3VwcG9ydGVkIGNoaWxkIG5vZGU6IFwiICsgY2hpbGQpXG4gIH1cbn1cbiJdLCJuYW1lcyI6W10sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/crelt/index.js\n");

/***/ })

};
;