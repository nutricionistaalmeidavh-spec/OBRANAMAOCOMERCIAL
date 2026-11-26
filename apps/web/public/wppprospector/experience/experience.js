var zA = Object.defineProperty;
var RA = (i, a, s) => a in i ? zA(i, a, { enumerable: !0, configurable: !0, writable: !0, value: s }) : i[a] = s;
var zt = (i, a, s) => RA(i, typeof a != "symbol" ? a + "" : a, s);
function NA(i, a) {
  for (var s = 0; s < a.length; s++) {
    const o = a[s];
    if (typeof o != "string" && !Array.isArray(o)) {
      for (const c in o)
        if (c !== "default" && !(c in i)) {
          const d = Object.getOwnPropertyDescriptor(o, c);
          d && Object.defineProperty(i, c, d.get ? d : {
            enumerable: !0,
            get: () => o[c]
          });
        }
    }
  }
  return Object.freeze(Object.defineProperty(i, Symbol.toStringTag, { value: "Module" }));
}
function _A(i) {
  return i && i.__esModule && Object.prototype.hasOwnProperty.call(i, "default") ? i.default : i;
}
var $f = { exports: {} }, At = {};
/**
 * @license React
 * react.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var E0;
function VA() {
  if (E0) return At;
  E0 = 1;
  var i = Symbol.for("react.transitional.element"), a = Symbol.for("react.portal"), s = Symbol.for("react.fragment"), o = Symbol.for("react.strict_mode"), c = Symbol.for("react.profiler"), d = Symbol.for("react.consumer"), f = Symbol.for("react.context"), h = Symbol.for("react.forward_ref"), p = Symbol.for("react.suspense"), g = Symbol.for("react.memo"), v = Symbol.for("react.lazy"), y = Symbol.for("react.activity"), S = Symbol.for("react.view_transition"), E = Symbol.iterator;
  function A(T) {
    return T === null || typeof T != "object" ? null : (T = E && T[E] || T["@@iterator"], typeof T == "function" ? T : null);
  }
  var w = {
    isMounted: function() {
      return !1;
    },
    enqueueForceUpdate: function() {
    },
    enqueueReplaceState: function() {
    },
    enqueueSetState: function() {
    }
  }, M = Object.assign, C = {};
  function N(T, U, k) {
    this.props = T, this.context = U, this.refs = C, this.updater = k || w;
  }
  N.prototype.isReactComponent = {}, N.prototype.setState = function(T, U) {
    if (typeof T != "object" && typeof T != "function" && T != null)
      throw Error(
        "takes an object of state variables to update or a function which returns an object of state variables."
      );
    this.updater.enqueueSetState(this, T, U, "setState");
  }, N.prototype.forceUpdate = function(T) {
    this.updater.enqueueForceUpdate(this, T, "forceUpdate");
  };
  function H() {
  }
  H.prototype = N.prototype;
  function X(T, U, k) {
    this.props = T, this.context = U, this.refs = C, this.updater = k || w;
  }
  var I = X.prototype = new H();
  I.constructor = X, M(I, N.prototype), I.isPureReactComponent = !0;
  var et = Array.isArray;
  function z() {
  }
  var D = { H: null, A: null, T: null, S: null }, at = Object.prototype.hasOwnProperty;
  function lt(T, U, k) {
    var J = k.ref;
    return {
      $$typeof: i,
      type: T,
      key: U,
      ref: J !== void 0 ? J : null,
      props: k
    };
  }
  function st(T, U) {
    return lt(T.type, U, T.props);
  }
  function dt(T) {
    return typeof T == "object" && T !== null && T.$$typeof === i;
  }
  function vt(T) {
    var U = { "=": "=0", ":": "=2" };
    return "$" + T.replace(/[=:]/g, function(k) {
      return U[k];
    });
  }
  var xt = /\/+/g;
  function St(T, U) {
    return typeof T == "object" && T !== null && T.key != null ? vt("" + T.key) : U.toString(36);
  }
  function F(T) {
    switch (T.status) {
      case "fulfilled":
        return T.value;
      case "rejected":
        throw T.reason;
      default:
        switch (typeof T.status == "string" ? T.then(z, z) : (T.status = "pending", T.then(
          function(U) {
            T.status === "pending" && (T.status = "fulfilled", T.value = U);
          },
          function(U) {
            T.status === "pending" && (T.status = "rejected", T.reason = U);
          }
        )), T.status) {
          case "fulfilled":
            return T.value;
          case "rejected":
            throw T.reason;
        }
    }
    throw T;
  }
  function rt(T, U, k, J, it) {
    var W = typeof T;
    (W === "undefined" || W === "boolean") && (T = null);
    var ft = !1;
    if (T === null) ft = !0;
    else
      switch (W) {
        case "bigint":
        case "string":
        case "number":
          ft = !0;
          break;
        case "object":
          switch (T.$$typeof) {
            case i:
            case a:
              ft = !0;
              break;
            case v:
              return ft = T._init, rt(
                ft(T._payload),
                U,
                k,
                J,
                it
              );
          }
      }
    if (ft)
      return it = it(T), ft = J === "" ? "." + St(T, 0) : J, et(it) ? (k = "", ft != null && (k = ft.replace(xt, "$&/") + "/"), rt(it, U, k, "", function(ct) {
        return ct;
      })) : it != null && (dt(it) && (it = st(
        it,
        k + (it.key == null || T && T.key === it.key ? "" : ("" + it.key).replace(
          xt,
          "$&/"
        ) + "/") + ft
      )), U.push(it)), 1;
    ft = 0;
    var P = J === "" ? "." : J + ":";
    if (et(T))
      for (var G = 0; G < T.length; G++)
        J = T[G], W = P + St(J, G), ft += rt(
          J,
          U,
          k,
          W,
          it
        );
    else if (G = A(T), typeof G == "function")
      for (T = G.call(T), G = 0; !(J = T.next()).done; )
        J = J.value, W = P + St(J, G++), ft += rt(
          J,
          U,
          k,
          W,
          it
        );
    else if (W === "object") {
      if (typeof T.then == "function")
        return rt(
          F(T),
          U,
          k,
          J,
          it
        );
      throw U = String(T), Error(
        "Objects are not valid as a React child (found: " + (U === "[object Object]" ? "object with keys {" + Object.keys(T).join(", ") + "}" : U) + "). If you meant to render a collection of children, use an array instead."
      );
    }
    return ft;
  }
  function ut(T, U, k) {
    if (T == null) return T;
    var J = [], it = 0;
    return rt(T, J, "", "", function(W) {
      return U.call(k, W, it++);
    }), J;
  }
  function nt(T) {
    if (T._status === -1) {
      var U = T._result, k = U();
      k.then(
        function(J) {
          (T._status === 0 || T._status === -1) && (T._status = 1, T._result = J, k.status === void 0 && (k.status = "fulfilled", k.value = J));
        },
        function(J) {
          (T._status === 0 || T._status === -1) && (T._status = 2, T._result = J, k.status === void 0 && (k.status = "rejected", k.reason = J));
        }
      ), T._status === -1 && (T._status = 0, T._result = k);
    }
    if (T._status === 1) return T._result.default;
    throw T._result;
  }
  var L = typeof reportError == "function" ? reportError : function(T) {
    if (typeof window == "object" && typeof window.ErrorEvent == "function") {
      var U = new window.ErrorEvent("error", {
        bubbles: !0,
        cancelable: !0,
        message: typeof T == "object" && T !== null && typeof T.message == "string" ? String(T.message) : String(T),
        error: T
      });
      if (!window.dispatchEvent(U)) return;
    } else if (typeof process == "object" && typeof process.emit == "function") {
      process.emit("uncaughtException", T);
      return;
    }
    console.error(T);
  };
  function K(T) {
    var U = D.T, k = {};
    k.types = U !== null ? U.types : null, D.T = k;
    try {
      var J = T(), it = D.S;
      it !== null && it(k, J), typeof J == "object" && J !== null && typeof J.then == "function" && J.then(z, L);
    } catch (W) {
      L(W);
    } finally {
      U !== null && k.types !== null && (U.types = k.types), D.T = U;
    }
  }
  function $(T) {
    var U = D.T;
    if (U !== null) {
      var k = U.types;
      k === null ? U.types = [T] : k.indexOf(T) === -1 && k.push(T);
    } else K($.bind(null, T));
  }
  var tt = {
    map: ut,
    forEach: function(T, U, k) {
      ut(
        T,
        function() {
          U.apply(this, arguments);
        },
        k
      );
    },
    count: function(T) {
      var U = 0;
      return ut(T, function() {
        U++;
      }), U;
    },
    toArray: function(T) {
      return ut(T, function(U) {
        return U;
      }) || [];
    },
    only: function(T) {
      if (!dt(T))
        throw Error(
          "React.Children.only expected to receive a single React element child."
        );
      return T;
    }
  };
  return At.Activity = y, At.Children = tt, At.Component = N, At.Fragment = s, At.Profiler = c, At.PureComponent = X, At.StrictMode = o, At.Suspense = p, At.ViewTransition = S, At.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = D, At.__COMPILER_RUNTIME = {
    __proto__: null,
    c: function(T) {
      return D.H.useMemoCache(T);
    }
  }, At.addTransitionType = $, At.cache = function(T) {
    return function() {
      return T.apply(null, arguments);
    };
  }, At.cacheSignal = function() {
    return null;
  }, At.cloneElement = function(T, U, k) {
    if (T == null)
      throw Error(
        "The argument must be a React element, but you passed " + T + "."
      );
    var J = M({}, T.props), it = T.key;
    if (U != null)
      for (W in U.key !== void 0 && (it = "" + U.key), U)
        !at.call(U, W) || W === "key" || W === "__self" || W === "__source" || W === "ref" && U.ref === void 0 || (J[W] = U[W]);
    var W = arguments.length - 2;
    if (W === 1) J.children = k;
    else if (1 < W) {
      for (var ft = Array(W), P = 0; P < W; P++)
        ft[P] = arguments[P + 2];
      J.children = ft;
    }
    return lt(T.type, it, J);
  }, At.createContext = function(T) {
    return T = {
      $$typeof: f,
      _currentValue: T,
      _currentValue2: T,
      _threadCount: 0,
      Provider: null,
      Consumer: null
    }, T.Provider = T, T.Consumer = {
      $$typeof: d,
      _context: T
    }, T;
  }, At.createElement = function(T, U, k) {
    var J, it = {}, W = null;
    if (U != null)
      for (J in U.key !== void 0 && (W = "" + U.key), U)
        at.call(U, J) && J !== "key" && J !== "__self" && J !== "__source" && (it[J] = U[J]);
    var ft = arguments.length - 2;
    if (ft === 1) it.children = k;
    else if (1 < ft) {
      for (var P = Array(ft), G = 0; G < ft; G++)
        P[G] = arguments[G + 2];
      it.children = P;
    }
    if (T && T.defaultProps)
      for (J in ft = T.defaultProps, ft)
        it[J] === void 0 && (it[J] = ft[J]);
    return lt(T, W, it);
  }, At.createRef = function() {
    return { current: null };
  }, At.forwardRef = function(T) {
    return { $$typeof: h, render: T };
  }, At.isValidElement = dt, At.lazy = function(T) {
    return {
      $$typeof: v,
      _payload: { _status: -1, _result: T },
      _init: nt
    };
  }, At.memo = function(T, U) {
    return {
      $$typeof: g,
      type: T,
      compare: U === void 0 ? null : U
    };
  }, At.startTransition = K, At.unstable_useCacheRefresh = function() {
    return D.H.useCacheRefresh();
  }, At.use = function(T) {
    return D.H.use(T);
  }, At.useActionState = function(T, U, k) {
    return D.H.useActionState(T, U, k);
  }, At.useCallback = function(T, U) {
    return D.H.useCallback(T, U);
  }, At.useContext = function(T) {
    return D.H.useContext(T);
  }, At.useDebugValue = function() {
  }, At.useDeferredValue = function(T, U) {
    return D.H.useDeferredValue(T, U);
  }, At.useEffect = function(T, U) {
    return D.H.useEffect(T, U);
  }, At.useEffectEvent = function(T) {
    return D.H.useEffectEvent(T);
  }, At.useId = function() {
    return D.H.useId();
  }, At.useImperativeHandle = function(T, U, k) {
    return D.H.useImperativeHandle(T, U, k);
  }, At.useInsertionEffect = function(T, U) {
    return D.H.useInsertionEffect(T, U);
  }, At.useLayoutEffect = function(T, U) {
    return D.H.useLayoutEffect(T, U);
  }, At.useMemo = function(T, U) {
    return D.H.useMemo(T, U);
  }, At.useOptimistic = function(T, U) {
    return D.H.useOptimistic(T, U);
  }, At.useReducer = function(T, U, k) {
    return D.H.useReducer(T, U, k);
  }, At.useRef = function(T) {
    return D.H.useRef(T);
  }, At.useState = function(T) {
    return D.H.useState(T);
  }, At.useSyncExternalStore = function(T, U, k) {
    return D.H.useSyncExternalStore(
      T,
      U,
      k
    );
  }, At.useTransition = function() {
    return D.H.useTransition();
  }, At.version = "19.3.1", At;
}
var A0;
function oh() {
  return A0 || (A0 = 1, $f.exports = VA()), $f.exports;
}
var q = oh();
const LA = /* @__PURE__ */ _A(q), UA = /* @__PURE__ */ NA({
  __proto__: null,
  default: LA
}, [q]);
var td = { exports: {} }, zs = {}, ed = { exports: {} }, nd = {};
/**
 * @license React
 * scheduler.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var x0;
function BA() {
  return x0 || (x0 = 1, (function(i) {
    function a(F, rt) {
      var ut = F.length;
      F.push(rt);
      t: for (; 0 < ut; ) {
        var nt = ut - 1 >>> 1, L = F[nt];
        if (0 < c(L, rt))
          F[nt] = rt, F[ut] = L, ut = nt;
        else break t;
      }
    }
    function s(F) {
      return F.length === 0 ? null : F[0];
    }
    function o(F) {
      if (F.length === 0) return null;
      var rt = F[0], ut = F.pop();
      if (ut !== rt) {
        F[0] = ut;
        t: for (var nt = 0, L = F.length, K = L >>> 1; nt < K; ) {
          var $ = 2 * (nt + 1) - 1, tt = F[$], T = $ + 1, U = F[T];
          if (0 > c(tt, ut))
            T < L && 0 > c(U, tt) ? (F[nt] = U, F[T] = ut, nt = T) : (F[nt] = tt, F[$] = ut, nt = $);
          else if (T < L && 0 > c(U, ut))
            F[nt] = U, F[T] = ut, nt = T;
          else break t;
        }
      }
      return rt;
    }
    function c(F, rt) {
      var ut = F.sortIndex - rt.sortIndex;
      return ut !== 0 ? ut : F.id - rt.id;
    }
    if (i.unstable_now = void 0, typeof performance == "object" && typeof performance.now == "function") {
      var d = performance;
      i.unstable_now = function() {
        return d.now();
      };
    } else {
      var f = Date, h = f.now();
      i.unstable_now = function() {
        return f.now() - h;
      };
    }
    var p = [], g = [], v = 1, y = null, S = 3, E = !1, A = !1, w = !1, M = !1, C = typeof setTimeout == "function" ? setTimeout : null, N = typeof clearTimeout == "function" ? clearTimeout : null, H = typeof setImmediate < "u" ? setImmediate : null;
    function X(F) {
      for (var rt = s(g); rt !== null; ) {
        if (rt.callback === null) o(g);
        else if (rt.startTime <= F)
          o(g), rt.sortIndex = rt.expirationTime, a(p, rt);
        else break;
        rt = s(g);
      }
    }
    function I(F) {
      if (w = !1, X(F), !A)
        if (s(p) !== null)
          A = !0, et || (et = !0, dt());
        else {
          var rt = s(g);
          rt !== null && St(I, rt.startTime - F);
        }
    }
    var et = !1, z = -1, D = 5, at = -1;
    function lt() {
      return M ? !0 : !(i.unstable_now() - at < D);
    }
    function st() {
      if (M = !1, et) {
        var F = i.unstable_now();
        at = F;
        var rt = !0;
        try {
          t: {
            A = !1, w && (w = !1, N(z), z = -1), E = !0;
            var ut = S;
            try {
              e: {
                for (X(F), y = s(p); y !== null && !(y.expirationTime > F && lt()); ) {
                  var nt = y.callback;
                  if (typeof nt == "function") {
                    y.callback = null, S = y.priorityLevel;
                    var L = nt(
                      y.expirationTime <= F
                    );
                    if (F = i.unstable_now(), typeof L == "function") {
                      y.callback = L, X(F), rt = !0;
                      break e;
                    }
                    y === s(p) && o(p), X(F);
                  } else o(p);
                  y = s(p);
                }
                if (y !== null) rt = !0;
                else {
                  var K = s(g);
                  K !== null && St(
                    I,
                    K.startTime - F
                  ), rt = !1;
                }
              }
              break t;
            } finally {
              y = null, S = ut, E = !1;
            }
            rt = void 0;
          }
        } finally {
          rt ? dt() : et = !1;
        }
      }
    }
    var dt;
    if (typeof H == "function")
      dt = function() {
        H(st);
      };
    else if (typeof MessageChannel < "u") {
      var vt = new MessageChannel(), xt = vt.port2;
      vt.port1.onmessage = st, dt = function() {
        xt.postMessage(null);
      };
    } else
      dt = function() {
        C(st, 0);
      };
    function St(F, rt) {
      z = C(function() {
        F(i.unstable_now());
      }, rt);
    }
    i.unstable_IdlePriority = 5, i.unstable_ImmediatePriority = 1, i.unstable_LowPriority = 4, i.unstable_NormalPriority = 3, i.unstable_Profiling = null, i.unstable_UserBlockingPriority = 2, i.unstable_cancelCallback = function(F) {
      F.callback = null;
    }, i.unstable_forceFrameRate = function(F) {
      0 > F || 125 < F ? console.error(
        "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"
      ) : D = 0 < F ? Math.floor(1e3 / F) : 5;
    }, i.unstable_getCurrentPriorityLevel = function() {
      return S;
    }, i.unstable_next = function(F) {
      switch (S) {
        case 1:
        case 2:
        case 3:
          var rt = 3;
          break;
        default:
          rt = S;
      }
      var ut = S;
      S = rt;
      try {
        return F();
      } finally {
        S = ut;
      }
    }, i.unstable_requestPaint = function() {
      M = !0;
    }, i.unstable_runWithPriority = function(F, rt) {
      switch (F) {
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
          break;
        default:
          F = 3;
      }
      var ut = S;
      S = F;
      try {
        return rt();
      } finally {
        S = ut;
      }
    }, i.unstable_scheduleCallback = function(F, rt, ut) {
      var nt = i.unstable_now();
      switch (typeof ut == "object" && ut !== null ? (ut = ut.delay, ut = typeof ut == "number" && 0 < ut ? nt + ut : nt) : ut = nt, F) {
        case 1:
          var L = -1;
          break;
        case 2:
          L = 250;
          break;
        case 5:
          L = 1073741823;
          break;
        case 4:
          L = 1e4;
          break;
        default:
          L = 5e3;
      }
      return L = ut + L, F = {
        id: v++,
        callback: rt,
        priorityLevel: F,
        startTime: ut,
        expirationTime: L,
        sortIndex: -1
      }, ut > nt ? (F.sortIndex = ut, a(g, F), s(p) === null && F === s(g) && (w ? (N(z), z = -1) : w = !0, St(I, ut - nt))) : (F.sortIndex = L, a(p, F), A || E || (A = !0, et || (et = !0, dt()))), F;
    }, i.unstable_shouldYield = lt, i.unstable_wrapCallback = function(F) {
      var rt = S;
      return function() {
        var ut = S;
        S = rt;
        try {
          return F.apply(this, arguments);
        } finally {
          S = ut;
        }
      };
    };
  })(nd)), nd;
}
var M0;
function HA() {
  return M0 || (M0 = 1, ed.exports = BA()), ed.exports;
}
var id = { exports: {} }, Me = {};
/**
 * @license React
 * react-dom.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var w0;
function jA() {
  if (w0) return Me;
  w0 = 1;
  var i = oh();
  function a(v) {
    var y = "https://react.dev/errors/" + v;
    if (1 < arguments.length) {
      y += "?args[]=" + encodeURIComponent(arguments[1]);
      for (var S = 2; S < arguments.length; S++)
        y += "&args[]=" + encodeURIComponent(arguments[S]);
    }
    return "Minified React error #" + v + "; visit " + y + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
  }
  function s() {
  }
  var o = {
    d: {
      f: s,
      r: function() {
        throw Error(a(522));
      },
      D: s,
      C: s,
      L: s,
      m: s,
      X: s,
      S: s,
      M: s
    },
    p: 0,
    findDOMNode: null
  }, c = Symbol.for("react.portal"), d = Symbol.for("react.recoverable"), f = Symbol.for("react.optimistic_key");
  function h(v, y, S) {
    var E = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
    return {
      $$typeof: c,
      key: E == null ? null : E === f ? f : "" + E,
      children: v,
      containerInfo: y,
      implementation: S
    };
  }
  var p = i.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  function g(v, y) {
    if (v === "font") return "";
    if (typeof y == "string")
      return y === "use-credentials" ? y : "";
  }
  return Me.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = o, Me.browser = function(v) {
    return { $$typeof: d, _reason: v };
  }, Me.createPortal = function(v, y) {
    var S = 2 < arguments.length && arguments[2] !== void 0 ? arguments[2] : null;
    if (!y || y.nodeType !== 1 && y.nodeType !== 9 && y.nodeType !== 11)
      throw Error(a(299));
    return h(v, y, null, S);
  }, Me.flushSync = function(v) {
    var y = p.T, S = o.p;
    try {
      if (p.T = null, o.p = 2, v) return v();
    } finally {
      p.T = y, o.p = S, o.d.f();
    }
  }, Me.preconnect = function(v, y) {
    typeof v == "string" && (y ? (y = y.crossOrigin, y = typeof y == "string" ? y === "use-credentials" ? y : "" : void 0) : y = null, o.d.C(v, y));
  }, Me.prefetchDNS = function(v) {
    typeof v == "string" && o.d.D(v);
  }, Me.preinit = function(v, y) {
    if (typeof v == "string" && y && typeof y.as == "string") {
      var S = y.as, E = g(S, y.crossOrigin), A = typeof y.integrity == "string" ? y.integrity : void 0, w = typeof y.fetchPriority == "string" ? y.fetchPriority : void 0;
      S === "style" ? o.d.S(
        v,
        typeof y.precedence == "string" ? y.precedence : void 0,
        {
          crossOrigin: E,
          integrity: A,
          fetchPriority: w
        }
      ) : S === "script" && o.d.X(v, {
        crossOrigin: E,
        integrity: A,
        fetchPriority: w,
        nonce: typeof y.nonce == "string" ? y.nonce : void 0
      });
    }
  }, Me.preinitModule = function(v, y) {
    if (typeof v == "string")
      if (typeof y == "object" && y !== null) {
        if (y.as == null || y.as === "script") {
          var S = g(
            y.as,
            y.crossOrigin
          );
          o.d.M(v, {
            crossOrigin: S,
            integrity: typeof y.integrity == "string" ? y.integrity : void 0,
            nonce: typeof y.nonce == "string" ? y.nonce : void 0,
            fetchPriority: typeof y.fetchPriority == "string" ? y.fetchPriority : void 0
          });
        }
      } else y == null && o.d.M(v);
  }, Me.preload = function(v, y) {
    if (typeof v == "string" && typeof y == "object" && y !== null && typeof y.as == "string") {
      var S = y.as, E = g(S, y.crossOrigin);
      o.d.L(v, S, {
        crossOrigin: E,
        integrity: typeof y.integrity == "string" ? y.integrity : void 0,
        nonce: typeof y.nonce == "string" ? y.nonce : void 0,
        type: typeof y.type == "string" ? y.type : void 0,
        fetchPriority: typeof y.fetchPriority == "string" ? y.fetchPriority : void 0,
        referrerPolicy: typeof y.referrerPolicy == "string" ? y.referrerPolicy : void 0,
        imageSrcSet: typeof y.imageSrcSet == "string" ? y.imageSrcSet : void 0,
        imageSizes: typeof y.imageSizes == "string" ? y.imageSizes : void 0,
        media: typeof y.media == "string" ? y.media : void 0
      });
    }
  }, Me.preloadModule = function(v, y) {
    if (typeof v == "string")
      if (y) {
        var S = g(y.as, y.crossOrigin);
        o.d.m(v, {
          as: typeof y.as == "string" && y.as !== "script" ? y.as : void 0,
          crossOrigin: S,
          integrity: typeof y.integrity == "string" ? y.integrity : void 0,
          nonce: typeof y.nonce == "string" ? y.nonce : void 0,
          fetchPriority: typeof y.fetchPriority == "string" ? y.fetchPriority : void 0
        });
      } else o.d.m(v);
  }, Me.requestFormReset = function(v) {
    o.d.r(v);
  }, Me.unstable_batchedUpdates = function(v, y) {
    return v(y);
  }, Me.useFormState = function(v, y, S) {
    return p.H.useFormState(v, y, S);
  }, Me.useFormStatus = function() {
    return p.H.useHostTransitionStatus();
  }, Me.version = "19.3.1", Me;
}
var C0;
function wb() {
  if (C0) return id.exports;
  C0 = 1;
  function i() {
    if (!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != "function"))
      try {
        __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(i);
      } catch (a) {
        console.error(a);
      }
  }
  return i(), id.exports = jA(), id.exports;
}
/**
 * @license React
 * react-dom-client.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var D0;
function GA() {
  if (D0) return zs;
  D0 = 1;
  var i = HA(), a = oh(), s = wb();
  function o(t) {
    var e = "https://react.dev/errors/" + t;
    if (1 < arguments.length) {
      e += "?args[]=" + encodeURIComponent(arguments[1]);
      for (var n = 2; n < arguments.length; n++)
        e += "&args[]=" + encodeURIComponent(arguments[n]);
    }
    return "Minified React error #" + t + "; visit " + e + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
  }
  function c(t) {
    return !(!t || t.nodeType !== 1 && t.nodeType !== 9 && t.nodeType !== 11);
  }
  function d(t) {
    for (var e = t, n = e; n && !n.alternate; )
      e = n, (e.flags & 4098) !== 0 && (t = e.return), n = e.return;
    for (; e.return; ) e = e.return;
    return e.tag === 3 ? t : null;
  }
  function f(t) {
    if (t.tag === 13) {
      var e = t.memoizedState;
      if (e === null && (t = t.alternate, t !== null && (e = t.memoizedState)), e !== null) return e.dehydrated;
    }
    return null;
  }
  function h(t) {
    if (t.tag === 31) {
      var e = t.memoizedState;
      if (e === null && (t = t.alternate, t !== null && (e = t.memoizedState)), e !== null) return e.dehydrated;
    }
    return null;
  }
  function p(t) {
    if (d(t) !== t)
      throw Error(o(188));
  }
  function g(t) {
    var e = t.alternate;
    if (!e) {
      if (e = d(t), e === null) throw Error(o(188));
      return e !== t ? null : t;
    }
    for (var n = t, l = e; ; ) {
      var r = n.return;
      if (r === null) break;
      var u = r.alternate;
      if (u === null) {
        if (l = r.return, l !== null) {
          n = l;
          continue;
        }
        break;
      }
      if (r.child === u.child) {
        for (u = r.child; u; ) {
          if (u === n) return p(r), t;
          if (u === l) return p(r), e;
          u = u.sibling;
        }
        throw Error(o(188));
      }
      if (n.return !== l.return) n = r, l = u;
      else {
        for (var m = !1, b = r.child; b; ) {
          if (b === n) {
            m = !0, n = r, l = u;
            break;
          }
          if (b === l) {
            m = !0, l = r, n = u;
            break;
          }
          b = b.sibling;
        }
        if (!m) {
          for (b = u.child; b; ) {
            if (b === n) {
              m = !0, n = u, l = r;
              break;
            }
            if (b === l) {
              m = !0, l = u, n = r;
              break;
            }
            b = b.sibling;
          }
          if (!m) throw Error(o(189));
        }
      }
      if (n.alternate !== l) throw Error(o(190));
    }
    if (n.tag !== 3) throw Error(o(188));
    return n.stateNode.current === n ? t : e;
  }
  function v(t) {
    var e = t.tag;
    if (e === 5 || e === 26 || e === 27 || e === 6) return t;
    for (t = t.child; t !== null; ) {
      if (e = v(t), e !== null) return e;
      t = t.sibling;
    }
    return null;
  }
  function y(t, e, n, l, r, u) {
    for (; t !== null; ) {
      if ((t.tag === 5 || t.tag === 27 || t.tag === 6) && n(t, l, r, u) || (t.tag !== 22 || t.memoizedState === null) && (e || t.tag !== 5 && t.tag !== 27) && y(
        t.child,
        e,
        n,
        l,
        r,
        u
      ))
        return !0;
      t = t.sibling;
    }
    return !1;
  }
  function S(t) {
    for (t = t.return; t !== null; ) {
      if (t.tag === 3 || t.tag === 5 || t.tag === 27) return t;
      t = t.return;
    }
    return null;
  }
  function E(t) {
    var e = !1;
    for (t = t.return; t !== null && (t.tag === 4 && (e = !0), !(t.tag === 3 || t.tag === 5 || t.tag === 27)); )
      t = t.return;
    return e;
  }
  function A(t) {
    var e = [null, null], n = S(t);
    return n === null || w(
      e,
      t,
      n.child,
      { foundSelf: !1 }
    ), e;
  }
  function w(t, e, n, l) {
    for (; n !== null; ) {
      if (n === e) l.foundSelf = !0;
      else if (n.tag === 5 || n.tag === 27 || n.tag === 6) {
        if (l.foundSelf) return t[1] = n, !0;
        t[0] = n;
      } else if ((n.tag !== 22 || n.memoizedState === null) && w(
        t,
        e,
        n.child,
        l
      ))
        return !0;
      n = n.sibling;
    }
    return !1;
  }
  function M(t) {
    switch (t.tag) {
      case 5:
      case 27:
      case 6:
        return t.stateNode;
      case 3:
        return t.stateNode.containerInfo;
      default:
        throw Error(o(559));
    }
  }
  var C = null, N = null;
  function H(t, e, n) {
    return t === n ? !0 : t === e ? (C = t, !0) : !1;
  }
  function X(t, e, n) {
    return t === n ? (N = t, !1) : t === e ? (N !== null && (C = t), !0) : !1;
  }
  function I(t) {
    if (t === null) return null;
    do
      t = t === null ? null : t.return;
    while (t && t.tag !== 5 && t.tag !== 27 && t.tag !== 3);
    return t || null;
  }
  function et(t, e, n) {
    for (var l = 0, r = t; r; r = n(r)) l++;
    r = 0;
    for (var u = e; u; u = n(u)) r++;
    for (; 0 < l - r; ) t = n(t), l--;
    for (; 0 < r - l; ) e = n(e), r--;
    for (; l--; ) {
      if (t === e || e !== null && t === e.alternate)
        return t;
      t = n(t), e = n(e);
    }
    return null;
  }
  var z = Object.assign, D = Symbol.for("react.element"), at = Symbol.for("react.transitional.element"), lt = Symbol.for("react.portal"), st = Symbol.for("react.fragment"), dt = Symbol.for("react.strict_mode"), vt = Symbol.for("react.profiler"), xt = Symbol.for("react.consumer"), St = Symbol.for("react.context"), F = Symbol.for("react.forward_ref"), rt = Symbol.for("react.suspense"), ut = Symbol.for("react.suspense_list"), nt = Symbol.for("react.memo"), L = Symbol.for("react.lazy"), K = Symbol.for("react.activity"), $ = Symbol.for("react.legacy_hidden"), tt = Symbol.for("react.memo_cache_sentinel"), T = Symbol.for("react.view_transition"), U = Symbol.for("react.recoverable"), k = Symbol.iterator;
  function J(t) {
    return t === null || typeof t != "object" ? null : (t = k && t[k] || t["@@iterator"], typeof t == "function" ? t : null);
  }
  var it = Symbol.for("react.client.reference");
  function W(t) {
    if (t == null) return null;
    if (typeof t == "function")
      return t.$$typeof === it ? null : t.displayName || t.name || null;
    if (typeof t == "string") return t;
    switch (t) {
      case st:
        return "Fragment";
      case vt:
        return "Profiler";
      case dt:
        return "StrictMode";
      case rt:
        return "Suspense";
      case ut:
        return "SuspenseList";
      case K:
        return "Activity";
      case T:
        return "ViewTransition";
    }
    if (typeof t == "object")
      switch (t.$$typeof) {
        case lt:
          return "Portal";
        case St:
          return t.displayName || "Context";
        case xt:
          return (t._context.displayName || "Context") + ".Consumer";
        case F:
          var e = t.render;
          return t = t.displayName, t || (t = e.displayName || e.name || "", t = t !== "" ? "ForwardRef(" + t + ")" : "ForwardRef"), t;
        case nt:
          return e = t.displayName || null, e !== null ? e : W(t.type) || "Memo";
        case L:
          e = t._payload, t = t._init;
          try {
            return W(t(e));
          } catch {
          }
      }
    return null;
  }
  var ft = Array.isArray, P = a.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, G = s.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, ct = {
    pending: !1,
    data: null,
    method: null,
    action: null
  }, Tt = [], Xt = -1;
  function Ht(t) {
    return { current: t };
  }
  function Ut(t) {
    0 > Xt || (t.current = Tt[Xt], Tt[Xt] = null, Xt--);
  }
  function Mt(t, e) {
    Xt++, Tt[Xt] = t.current, t.current = e;
  }
  var ie = Ht(null), qe = Ht(null), Ve = Ht(null), oi = Ht(null);
  function ri(t, e) {
    switch (Mt(Ve, e), Mt(qe, t), Mt(ie, null), e.nodeType) {
      case 9:
      case 11:
        t = (t = e.documentElement) && (t = t.namespaceURI) ? Ry(t) : 0;
        break;
      default:
        if (t = e.tagName, e = e.namespaceURI)
          e = Ry(e), t = Ny(e, t);
        else
          switch (t) {
            case "svg":
              t = 1;
              break;
            case "math":
              t = 2;
              break;
            default:
              t = 0;
          }
    }
    Ut(ie), Mt(ie, t);
  }
  function Yn() {
    Ut(ie), Ut(qe), Ut(Ve);
  }
  function wa(t) {
    var e = t.memoizedState;
    e !== null && (pl._currentValue = e.memoizedState, Mt(oi, t)), e = ie.current;
    var n = Ny(e, t.type);
    e !== n && (Mt(qe, t), Mt(ie, n));
  }
  function Ca(t) {
    qe.current === t && (Ut(ie), Ut(qe)), oi.current === t && (Ut(oi), pl._currentValue = ct);
  }
  var Da, no;
  function en(t) {
    if (Da === void 0)
      try {
        throw Error();
      } catch (n) {
        var e = n.stack.trim().match(/\n( *(at )?)/);
        Da = e && e[1] || "", no = -1 < n.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < n.stack.indexOf("@") ? "@unknown:0:0" : "";
      }
    return `
` + Da + t + no;
  }
  var wn = !1;
  function Xi(t, e) {
    if (!t || wn) return "";
    wn = !0;
    var n = Error.prepareStackTrace;
    Error.prepareStackTrace = void 0;
    try {
      var l = {
        DetermineComponentFrameRoot: function() {
          try {
            if (e) {
              var Z = function() {
                throw Error();
              };
              if (Object.defineProperty(Z.prototype, "props", {
                set: function() {
                  throw Error();
                }
              }), typeof Reflect == "object" && Reflect.construct) {
                try {
                  Reflect.construct(Z, []);
                } catch (ot) {
                  var R = ot;
                }
                Reflect.construct(t, [], Z);
              } else {
                try {
                  Z.call();
                } catch (ot) {
                  R = ot;
                }
                Z = !1;
                try {
                  var j = Object.getOwnPropertyDescriptor(
                    t.prototype,
                    "props"
                  );
                  Object.defineProperty(t.prototype, "props", {
                    configurable: !0,
                    set: function() {
                      throw Error();
                    }
                  }), Z = !0, new t();
                } finally {
                  Z && (j !== void 0 ? Object.defineProperty(t.prototype, "props", j) : delete t.prototype.props);
                }
              }
            } else {
              try {
                throw Error();
              } catch (ot) {
                R = ot;
              }
              (Z = t()) && typeof Z.catch == "function" && Z.catch(function() {
              });
            }
          } catch (ot) {
            if (ot && R && typeof ot.stack == "string")
              return [ot.stack, R.stack];
          }
          return [null, null];
        }
      };
      l.DetermineComponentFrameRoot.displayName = "DetermineComponentFrameRoot";
      var r = Object.getOwnPropertyDescriptor(
        l.DetermineComponentFrameRoot,
        "name"
      );
      r && r.configurable && Object.defineProperty(
        l.DetermineComponentFrameRoot,
        "name",
        { value: "DetermineComponentFrameRoot" }
      );
      var u = l.DetermineComponentFrameRoot(), m = u[0], b = u[1];
      if (m && b) {
        var x = m.split(`
`), V = b.split(`
`);
        for (r = l = 0; l < x.length && !x[l].includes("DetermineComponentFrameRoot"); )
          l++;
        for (; r < V.length && !V[r].includes(
          "DetermineComponentFrameRoot"
        ); )
          r++;
        if (l === x.length || r === V.length)
          for (l = x.length - 1, r = V.length - 1; 1 <= l && 0 <= r && x[l] !== V[r]; )
            r--;
        for (; 1 <= l && 0 <= r; l--, r--)
          if (x[l] !== V[r]) {
            if (l !== 1 || r !== 1)
              do
                if (l--, r--, 0 > r || x[l] !== V[r]) {
                  var Y = `
` + x[l].replace(" at new ", " at ");
                  return t.displayName && Y.includes("<anonymous>") && (Y = Y.replace("<anonymous>", t.displayName)), Y;
                }
              while (1 <= l && 0 <= r);
            break;
          }
      }
    } finally {
      wn = !1, Error.prepareStackTrace = n;
    }
    return (n = t ? t.displayName || t.name : "") ? en(n) : "";
  }
  function zl(t, e) {
    switch (t.tag) {
      case 26:
      case 27:
      case 5:
        return en(t.type);
      case 16:
        return en("Lazy");
      case 13:
        return t.child !== e && e !== null ? en("Suspense Fallback") : en("Suspense");
      case 19:
        return en("SuspenseList");
      case 0:
      case 15:
        return Xi(t.type, !1);
      case 11:
        return Xi(t.type.render, !1);
      case 1:
        return Xi(t.type, !0);
      case 31:
        return en("Activity");
      case 30:
        return en("ViewTransition");
      default:
        return "";
    }
  }
  function Qi(t) {
    try {
      var e = "", n = null;
      do
        e += zl(t, n), n = t, t = t.return;
      while (t);
      return e;
    } catch (l) {
      return `
Error generating stack: ` + l.message + `
` + l.stack;
    }
  }
  var Rl = Object.prototype.hasOwnProperty, Nl = i.unstable_scheduleCallback, _l = i.unstable_cancelCallback, Su = i.unstable_shouldYield, Tu = i.unstable_requestPaint, we = i.unstable_now, Eu = i.unstable_getCurrentPriorityLevel, Vl = i.unstable_ImmediatePriority, Ll = i.unstable_UserBlockingPriority, Zi = i.unstable_NormalPriority, Au = i.unstable_LowPriority, Ul = i.unstable_IdlePriority, io = i.log, xu = i.unstable_setDisableYieldValue, Bl = null, Xe = null;
  function ui(t) {
    if (typeof io == "function" && xu(t), Xe && typeof Xe.setStrictMode == "function")
      try {
        Xe.setStrictMode(Bl, t);
      } catch {
      }
  }
  var Qe = Math.clz32 ? Math.clz32 : XS, YS = Math.log, qS = Math.LN2;
  function XS(t) {
    return t >>>= 0, t === 0 ? 32 : 31 - (YS(t) / qS | 0) | 0;
  }
  var ao = 256, lo = 262144, so = 4194304;
  function Ki(t) {
    var e = t & 42;
    if (e !== 0) return e;
    switch (t & -t) {
      case 1:
        return 1;
      case 2:
        return 2;
      case 4:
        return 4;
      case 8:
        return 8;
      case 16:
        return 16;
      case 32:
        return 32;
      case 64:
        return 64;
      case 128:
        return 128;
      case 256:
      case 512:
      case 1024:
      case 2048:
      case 4096:
      case 8192:
      case 16384:
      case 32768:
      case 65536:
      case 131072:
        return t & -t;
      case 262144:
      case 524288:
      case 1048576:
      case 2097152:
        return t & 3932160;
      case 4194304:
      case 8388608:
      case 16777216:
      case 33554432:
        return t & 62914560;
      case 67108864:
        return 67108864;
      case 134217728:
        return 134217728;
      case 268435456:
        return 268435456;
      case 536870912:
        return 536870912;
      case 1073741824:
        return 0;
      default:
        return t;
    }
  }
  function oo(t, e, n) {
    var l = t.pendingLanes;
    if (l === 0) return 0;
    var r = 0, u = t.suspendedLanes, m = t.pingedLanes;
    t = t.warmLanes;
    var b = l & 134217727;
    return b !== 0 ? (l = b & ~u, l !== 0 ? r = Ki(l) : (m &= b, m !== 0 ? r = Ki(m) : n || (n = b & ~t, n !== 0 && (r = Ki(n))))) : (b = l & ~u, b !== 0 ? r = Ki(b) : m !== 0 ? r = Ki(m) : n || (n = l & ~t, n !== 0 && (r = Ki(n)))), r === 0 ? 0 : e !== 0 && e !== r && (e & u) === 0 && (u = r & -r, n = e & -e, u >= n || u === 32 && (n & 4194048) !== 0) ? e : r;
  }
  function Hl(t, e) {
    return (t.pendingLanes & ~(t.suspendedLanes & ~t.pingedLanes) & e) === 0;
  }
  function im(t, e) {
    (e & 8) !== 0 && (e |= e & 32);
    var n = t.entangledLanes;
    if (n !== 0)
      for (t = t.entanglements, n &= e; 0 < n; ) {
        var l = 31 - Qe(n), r = 1 << l;
        e |= t[l], n &= ~r;
      }
    return e;
  }
  function QS(t, e) {
    switch (t) {
      case 1:
      case 2:
      case 4:
      case 8:
      case 64:
        return e + 250;
      case 16:
      case 32:
      case 128:
      case 256:
      case 512:
      case 1024:
      case 2048:
      case 4096:
      case 8192:
      case 16384:
      case 32768:
      case 65536:
      case 131072:
      case 262144:
      case 524288:
      case 1048576:
      case 2097152:
        return e + 5e3;
      case 4194304:
      case 8388608:
      case 16777216:
      case 33554432:
        return -1;
      case 67108864:
      case 134217728:
      case 268435456:
      case 536870912:
      case 1073741824:
        return -1;
      default:
        return -1;
    }
  }
  function am() {
    var t = so;
    return so <<= 1, (so & 62914560) === 0 && (so = 4194304), t;
  }
  function Mu(t) {
    for (var e = [], n = 0; 31 > n; n++) e.push(t);
    return e;
  }
  function jl(t, e) {
    t.pendingLanes |= e, e !== 268435456 && (t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0);
  }
  function ZS(t, e, n, l, r, u) {
    var m = t.pendingLanes;
    t.pendingLanes = n, t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0, t.expiredLanes &= n, t.entangledLanes &= n, t.errorRecoveryDisabledLanes &= n, t.shellSuspendCounter = 0;
    var b = t.entanglements, x = t.expirationTimes, V = t.hiddenUpdates;
    for (n = m & ~n; 0 < n; ) {
      var Y = 31 - Qe(n), Z = 1 << Y;
      b[Y] = 0, x[Y] = -1;
      var R = V[Y];
      if (R !== null)
        for (V[Y] = null, Y = 0; Y < R.length; Y++) {
          var j = R[Y];
          j !== null && (j.lane &= -536870913);
        }
      n &= ~Z;
    }
    l !== 0 && lm(t, l, 0), u !== 0 && r === 0 && t.tag !== 0 && (t.suspendedLanes |= u & ~(m & ~e));
  }
  function lm(t, e, n) {
    t.pendingLanes |= e, t.suspendedLanes &= ~e;
    var l = 31 - Qe(e);
    t.entangledLanes |= e, t.entanglements[l] = t.entanglements[l] | 1073741824 | n & 261930;
  }
  function sm(t, e) {
    var n = t.entangledLanes |= e;
    for (t = t.entanglements; n; ) {
      var l = 31 - Qe(n), r = 1 << l;
      r & e | t[l] & e && (t[l] |= e), n &= ~r;
    }
  }
  function om(t, e) {
    var n = e & -e;
    return n = (n & 42) !== 0 ? 1 : wu(n), (n & (t.suspendedLanes | e)) !== 0 ? 0 : n;
  }
  function wu(t) {
    switch (t) {
      case 2:
        t = 1;
        break;
      case 8:
        t = 4;
        break;
      case 32:
        t = 16;
        break;
      case 256:
      case 512:
      case 1024:
      case 2048:
      case 4096:
      case 8192:
      case 16384:
      case 32768:
      case 65536:
      case 131072:
      case 262144:
      case 524288:
      case 1048576:
      case 2097152:
      case 4194304:
      case 8388608:
      case 16777216:
      case 33554432:
        t = 128;
        break;
      case 268435456:
        t = 134217728;
        break;
      default:
        t = 0;
    }
    return t;
  }
  function Cu(t) {
    return t &= -t, 2 < t ? 8 < t ? (t & 134217727) !== 0 ? 32 : 268435456 : 8 : 2;
  }
  function rm() {
    var t = G.p;
    return t !== 0 ? t : (t = window.event, t === void 0 ? 32 : p0(t.type));
  }
  function um(t, e) {
    var n = G.p;
    try {
      return G.p = t, e();
    } finally {
      G.p = n;
    }
  }
  var qn = Math.random().toString(36).slice(2), be = "__reactFiber$" + qn, Le = "__reactProps$" + qn, Oa = "__reactContainer$" + qn, cm = "__reactEvents$" + qn, KS = "__reactListeners$" + qn, kS = "__reactHandles$" + qn, fm = "__reactResources$" + qn, Gl = "__reactMarker$" + qn, ro = "__reactLoad$" + qn;
  function uo(t) {
    delete t[be], delete t[Le], delete t[KS], delete t[kS];
  }
  function ki(t) {
    var e;
    if (e = t[be]) return e;
    for (var n = t.parentNode; n; ) {
      if (e = n[Oa] || n[be]) {
        if (n = e.alternate, e.child !== null || n !== null && n.child !== null)
          for (t = Jy(t); t !== null; ) {
            if (n = t[be]) return n;
            t = Jy(t);
          }
        return e;
      }
      t = n, n = t.parentNode;
    }
    return null;
  }
  function za(t) {
    if (t = t[be] || t[Oa]) {
      var e = t.tag;
      if (e === 5 || e === 6 || e === 13 || e === 31 || e === 26 || e === 27 || e === 3)
        return t;
    }
    return null;
  }
  function Yl(t) {
    var e = t.tag;
    if (e === 5 || e === 26 || e === 27 || e === 6) return t.stateNode;
    throw Error(o(33));
  }
  function Ra(t) {
    var e = t[fm];
    return e || (e = t[fm] = { hoistableStyles: /* @__PURE__ */ new Map(), hoistableScripts: /* @__PURE__ */ new Map() }), e;
  }
  function pe(t) {
    t[Gl] = !0;
  }
  function dm(t) {
    t[ro] = void 0;
  }
  var hm = /* @__PURE__ */ new Set(), mm = {};
  function Pi(t, e) {
    Na(t, e), Na(t + "Capture", e);
  }
  function Na(t, e) {
    for (mm[t] = e, t = 0; t < e.length; t++)
      hm.add(e[t]);
  }
  var PS = RegExp(
    "^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$"
  ), pm = {}, gm = {};
  function JS(t) {
    return Rl.call(gm, t) ? !0 : Rl.call(pm, t) ? !1 : PS.test(t) ? gm[t] = !0 : (pm[t] = !0, !1);
  }
  var Bt = !1;
  function ym() {
    var t = Bt;
    return Bt = !1, t;
  }
  function co(t, e, n) {
    if (JS(e))
      if (n === null) t.removeAttribute(e);
      else {
        switch (typeof n) {
          case "undefined":
          case "function":
          case "symbol":
            t.removeAttribute(e);
            return;
          case "boolean":
            var l = e.toLowerCase().slice(0, 5);
            if (l !== "data-" && l !== "aria-") {
              t.removeAttribute(e);
              return;
            }
        }
        t.setAttribute(e, n);
      }
  }
  function fo(t, e, n) {
    if (n === null) t.removeAttribute(e);
    else {
      switch (typeof n) {
        case "undefined":
        case "function":
        case "symbol":
        case "boolean":
          t.removeAttribute(e);
          return;
      }
      t.setAttribute(e, n);
    }
  }
  function Xn(t, e, n, l) {
    if (l === null) t.removeAttribute(n);
    else {
      switch (typeof l) {
        case "undefined":
        case "function":
        case "symbol":
        case "boolean":
          t.removeAttribute(n);
          return;
      }
      t.setAttributeNS(e, n, l);
    }
  }
  function Ze(t) {
    switch (typeof t) {
      case "bigint":
      case "boolean":
      case "number":
      case "string":
      case "undefined":
        return t;
      case "object":
        return t;
      default:
        return "";
    }
  }
  function vm(t) {
    var e = t.type;
    return (t = t.nodeName) && t.toLowerCase() === "input" && (e === "checkbox" || e === "radio");
  }
  function FS(t, e, n) {
    var l = Object.getOwnPropertyDescriptor(
      t.constructor.prototype,
      e
    );
    if (!t.hasOwnProperty(e) && typeof l < "u" && typeof l.get == "function" && typeof l.set == "function") {
      var r = l.get, u = l.set;
      return Object.defineProperty(t, e, {
        configurable: !0,
        get: function() {
          return r.call(this);
        },
        set: function(m) {
          n = "" + m, u.call(this, m);
        }
      }), Object.defineProperty(t, e, {
        enumerable: l.enumerable
      }), {
        getValue: function() {
          return n;
        },
        setValue: function(m) {
          n = "" + m;
        },
        stopTracking: function() {
          t._valueTracker = null, delete t[e];
        }
      };
    }
  }
  function Du(t) {
    if (!t._valueTracker) {
      var e = vm(t) ? "checked" : "value";
      t._valueTracker = FS(
        t,
        e,
        "" + t[e]
      );
    }
  }
  function bm(t) {
    if (!t) return !1;
    var e = t._valueTracker;
    if (!e) return !0;
    var n = e.getValue(), l = "";
    return t && (l = vm(t) ? t.checked ? "true" : "false" : t.value), t = l, t !== n ? (e.setValue(t), !0) : !1;
  }
  var IS = /[\n"\\]/g;
  function nn(t) {
    return t.replace(
      IS,
      function(e) {
        return "\\" + e.charCodeAt(0).toString(16) + " ";
      }
    );
  }
  function Ou(t, e, n, l, r, u, m, b) {
    t.name = "", m != null && typeof m != "function" && typeof m != "symbol" && typeof m != "boolean" ? t.type = m : t.removeAttribute("type"), e != null ? m === "number" ? (e === 0 && t.value === "" || t.value != e) && (t.value = "" + Ze(e)) : t.value !== "" + Ze(e) && (t.value = "" + Ze(e)) : m !== "submit" && m !== "reset" || t.removeAttribute("value"), e != null ? m === "number" && t.value == e ? zu(t, Ze(t.value)) : zu(t, Ze(e)) : n != null ? zu(t, Ze(n)) : l != null && t.removeAttribute("value"), r == null && u != null && (t.defaultChecked = !!u), r != null && (t.checked = r && typeof r != "function" && typeof r != "symbol"), b != null && typeof b != "function" && typeof b != "symbol" && typeof b != "boolean" ? t.name = "" + Ze(b) : t.removeAttribute("name");
  }
  function Sm(t, e, n, l, r, u, m, b) {
    if (u != null && typeof u != "function" && typeof u != "symbol" && typeof u != "boolean" && (t.type = u), e != null || n != null) {
      if (!(u !== "submit" && u !== "reset" || e != null)) {
        Du(t);
        return;
      }
      n = n != null ? "" + Ze(n) : "", e = e != null ? "" + Ze(e) : n, b || e === t.value || (t.value = e), t.defaultValue = e;
    }
    l = l ?? r, l = typeof l != "function" && typeof l != "symbol" && !!l, t.checked = b ? t.checked : !!l, t.defaultChecked = !!l, m != null && typeof m != "function" && typeof m != "symbol" && typeof m != "boolean" && (t.name = m), Du(t);
  }
  function zu(t, e) {
    t.defaultValue !== "" + e && (t.defaultValue = "" + e);
  }
  function _a(t, e, n, l) {
    if (t = t.options, e) {
      e = {};
      for (var r = 0; r < n.length; r++)
        e["$" + n[r]] = !0;
      for (n = 0; n < t.length; n++)
        r = e.hasOwnProperty("$" + t[n].value), t[n].selected !== r && (t[n].selected = r), r && l && (t[n].defaultSelected = !0);
    } else {
      for (n = "" + Ze(n), e = null, r = 0; r < t.length; r++) {
        if (t[r].value === n) {
          t[r].selected = !0, l && (t[r].defaultSelected = !0);
          return;
        }
        e !== null || t[r].disabled || (e = t[r]);
      }
      e !== null && (e.selected = !0);
    }
  }
  function Tm(t, e, n) {
    if (e != null && (e = "" + Ze(e), e !== t.value && (t.value = e), n == null)) {
      t.defaultValue !== e && (t.defaultValue = e);
      return;
    }
    t.defaultValue = n != null ? "" + Ze(n) : "";
  }
  function Em(t, e, n, l) {
    if (e == null) {
      if (l != null) {
        if (n != null) throw Error(o(92));
        if (ft(l)) {
          if (1 < l.length) throw Error(o(93));
          l = l[0];
        }
        n = l;
      }
      n == null && (n = ""), e = n;
    }
    n = Ze(e), t.defaultValue = n, l = t.textContent, l === n && l !== "" && l !== null && (t.value = l), Du(t);
  }
  function Va(t, e) {
    if (e) {
      var n = t.firstChild;
      if (n && n === t.lastChild && n.nodeType === 3) {
        n.nodeValue = e;
        return;
      }
    }
    t.textContent = e;
  }
  var WS = new Set(
    "animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp".split(
      " "
    )
  );
  function Am(t, e, n) {
    var l = e.indexOf("--") === 0;
    n == null || typeof n == "boolean" || n === "" ? l ? t.setProperty(e, "") : e === "float" ? t.cssFloat = "" : t[e] = "" : l ? t.setProperty(e, n) : typeof n != "number" || n === 0 || WS.has(e) ? e === "float" ? t.cssFloat = n : t[e] = ("" + n).trim() : t[e] = n + "px";
  }
  function xm(t, e, n) {
    if (e != null && typeof e != "object")
      throw Error(o(62));
    if (t = t.style, n != null) {
      for (var l in n)
        !n.hasOwnProperty(l) || e != null && e.hasOwnProperty(l) || (l.indexOf("--") === 0 ? t.setProperty(l, "") : l === "float" ? t.cssFloat = "" : t[l] = "", Bt = !0);
      for (var r in e)
        l = e[r], e.hasOwnProperty(r) && n[r] !== l && (Am(t, r, l), Bt = !0);
    } else
      for (var u in e)
        e.hasOwnProperty(u) && Am(t, u, e[u]);
  }
  function Ru(t) {
    if (t.indexOf("-") === -1) return !1;
    switch (t) {
      case "annotation-xml":
      case "color-profile":
      case "font-face":
      case "font-face-src":
      case "font-face-uri":
      case "font-face-format":
      case "font-face-name":
      case "missing-glyph":
        return !1;
      default:
        return !0;
    }
  }
  var $S = /* @__PURE__ */ new Map([
    ["acceptCharset", "accept-charset"],
    ["htmlFor", "for"],
    ["httpEquiv", "http-equiv"],
    ["crossOrigin", "crossorigin"],
    ["accentHeight", "accent-height"],
    ["alignmentBaseline", "alignment-baseline"],
    ["arabicForm", "arabic-form"],
    ["baselineShift", "baseline-shift"],
    ["capHeight", "cap-height"],
    ["clipPath", "clip-path"],
    ["clipRule", "clip-rule"],
    ["colorInterpolation", "color-interpolation"],
    ["colorInterpolationFilters", "color-interpolation-filters"],
    ["colorProfile", "color-profile"],
    ["colorRendering", "color-rendering"],
    ["dominantBaseline", "dominant-baseline"],
    ["enableBackground", "enable-background"],
    ["fillOpacity", "fill-opacity"],
    ["fillRule", "fill-rule"],
    ["floodColor", "flood-color"],
    ["floodOpacity", "flood-opacity"],
    ["fontFamily", "font-family"],
    ["fontSize", "font-size"],
    ["fontSizeAdjust", "font-size-adjust"],
    ["fontStretch", "font-stretch"],
    ["fontStyle", "font-style"],
    ["fontVariant", "font-variant"],
    ["fontWeight", "font-weight"],
    ["glyphName", "glyph-name"],
    ["glyphOrientationHorizontal", "glyph-orientation-horizontal"],
    ["glyphOrientationVertical", "glyph-orientation-vertical"],
    ["horizAdvX", "horiz-adv-x"],
    ["horizOriginX", "horiz-origin-x"],
    ["imageRendering", "image-rendering"],
    ["letterSpacing", "letter-spacing"],
    ["lightingColor", "lighting-color"],
    ["markerEnd", "marker-end"],
    ["markerMid", "marker-mid"],
    ["markerStart", "marker-start"],
    ["maskType", "mask-type"],
    ["overlinePosition", "overline-position"],
    ["overlineThickness", "overline-thickness"],
    ["paintOrder", "paint-order"],
    ["panose-1", "panose-1"],
    ["pointerEvents", "pointer-events"],
    ["renderingIntent", "rendering-intent"],
    ["shapeRendering", "shape-rendering"],
    ["stopColor", "stop-color"],
    ["stopOpacity", "stop-opacity"],
    ["strikethroughPosition", "strikethrough-position"],
    ["strikethroughThickness", "strikethrough-thickness"],
    ["strokeDasharray", "stroke-dasharray"],
    ["strokeDashoffset", "stroke-dashoffset"],
    ["strokeLinecap", "stroke-linecap"],
    ["strokeLinejoin", "stroke-linejoin"],
    ["strokeMiterlimit", "stroke-miterlimit"],
    ["strokeOpacity", "stroke-opacity"],
    ["strokeWidth", "stroke-width"],
    ["textAnchor", "text-anchor"],
    ["textDecoration", "text-decoration"],
    ["textRendering", "text-rendering"],
    ["transformOrigin", "transform-origin"],
    ["underlinePosition", "underline-position"],
    ["underlineThickness", "underline-thickness"],
    ["unicodeBidi", "unicode-bidi"],
    ["unicodeRange", "unicode-range"],
    ["unitsPerEm", "units-per-em"],
    ["vAlphabetic", "v-alphabetic"],
    ["vHanging", "v-hanging"],
    ["vIdeographic", "v-ideographic"],
    ["vMathematical", "v-mathematical"],
    ["vectorEffect", "vector-effect"],
    ["vertAdvY", "vert-adv-y"],
    ["vertOriginX", "vert-origin-x"],
    ["vertOriginY", "vert-origin-y"],
    ["wordSpacing", "word-spacing"],
    ["writingMode", "writing-mode"],
    ["xmlnsXlink", "xmlns:xlink"],
    ["xHeight", "x-height"]
  ]), tT = /^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;
  function ho(t) {
    return tT.test("" + t) ? "javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')" : t;
  }
  function Cn() {
  }
  var Nu = null;
  function _u(t) {
    return t = t.target || t.srcElement || window, t.correspondingUseElement && (t = t.correspondingUseElement), t.nodeType === 3 ? t.parentNode : t;
  }
  var La = null, Ua = null;
  function Mm(t) {
    var e = za(t);
    if (e && (t = e.stateNode)) {
      var n = t[Le] || null;
      t: switch (t = e.stateNode, e.type) {
        case "input":
          if (Ou(
            t,
            n.value,
            n.defaultValue,
            n.defaultValue,
            n.checked,
            n.defaultChecked,
            n.type,
            n.name
          ), e = n.name, n.type === "radio" && e != null) {
            for (n = t; n.parentNode; ) n = n.parentNode;
            for (n = n.querySelectorAll(
              'input[name="' + nn(
                "" + e
              ) + '"][type="radio"]'
            ), e = 0; e < n.length; e++) {
              var l = n[e];
              if (l !== t && l.form === t.form) {
                var r = l[Le] || null;
                if (!r) throw Error(o(90));
                Ou(
                  l,
                  r.value,
                  r.defaultValue,
                  r.defaultValue,
                  r.checked,
                  r.defaultChecked,
                  r.type,
                  r.name
                );
              }
            }
            for (e = 0; e < n.length; e++)
              l = n[e], l.form === t.form && bm(l);
          }
          break t;
        case "textarea":
          Tm(t, n.value, n.defaultValue);
          break t;
        case "select":
          e = n.value, e != null && _a(t, !!n.multiple, e, !1);
      }
    }
  }
  var Vu = !1;
  function wm(t, e, n) {
    if (Vu) return t(e, n);
    Vu = !0;
    try {
      var l = t(e);
      return l;
    } finally {
      if (Vu = !1, (La !== null || Ua !== null) && (hr(), La && (e = La, t = Ua, Ua = La = null, Mm(e), t)))
        for (e = 0; e < t.length; e++) Mm(t[e]);
    }
  }
  function ql(t, e) {
    var n = t.stateNode;
    if (n === null) return null;
    var l = n[Le] || null;
    if (l === null) return null;
    n = l[e];
    t: switch (e) {
      case "onClick":
      case "onClickCapture":
      case "onDoubleClick":
      case "onDoubleClickCapture":
      case "onMouseDown":
      case "onMouseDownCapture":
      case "onMouseMove":
      case "onMouseMoveCapture":
      case "onMouseUp":
      case "onMouseUpCapture":
      case "onMouseEnter":
        (l = !l.disabled) || (t = t.type, l = !(t === "button" || t === "input" || t === "select" || t === "textarea")), t = !l;
        break t;
      default:
        t = !1;
    }
    if (t) return null;
    if (n && typeof n != "function")
      throw Error(
        o(231, e, typeof n)
      );
    return n;
  }
  var Qn = !(typeof window > "u" || typeof window.document > "u" || typeof window.document.createElement > "u"), Lu = !1;
  if (Qn)
    try {
      var Xl = {};
      Object.defineProperty(Xl, "passive", {
        get: function() {
          Lu = !0;
        }
      }), window.addEventListener("test", Xl, Xl), window.removeEventListener("test", Xl, Xl);
    } catch {
      Lu = !1;
    }
  var ci = null, Uu = null, mo = null;
  function Cm() {
    if (mo) return mo;
    var t, e = Uu, n = e.length, l, r = "value" in ci ? ci.value : ci.textContent, u = r.length;
    for (t = 0; t < n && e[t] === r[t]; t++) ;
    var m = n - t;
    for (l = 1; l <= m && e[n - l] === r[u - l]; l++) ;
    return mo = r.slice(t, 1 < l ? 1 - l : void 0);
  }
  function po(t) {
    var e = t.keyCode;
    return "charCode" in t ? (t = t.charCode, t === 0 && e === 13 && (t = 13)) : t = e, t === 10 && (t = 13), 32 <= t || t === 13 ? t : 0;
  }
  function go() {
    return !0;
  }
  function Dm() {
    return !1;
  }
  function ze(t) {
    function e(n, l, r, u, m) {
      this._reactName = n, this._targetInst = r, this.type = l, this.nativeEvent = u, this.target = m, this.currentTarget = null;
      for (var b in t)
        t.hasOwnProperty(b) && (n = t[b], this[b] = n ? n(u) : u[b]);
      return this.isDefaultPrevented = (u.defaultPrevented != null ? u.defaultPrevented : u.returnValue === !1) ? go : Dm, this.isPropagationStopped = Dm, this;
    }
    return z(e.prototype, {
      preventDefault: function() {
        this.defaultPrevented = !0;
        var n = this.nativeEvent;
        n && (n.preventDefault ? n.preventDefault() : typeof n.returnValue != "unknown" && (n.returnValue = !1), this.isDefaultPrevented = go);
      },
      stopPropagation: function() {
        var n = this.nativeEvent;
        n && (n.stopPropagation ? n.stopPropagation() : typeof n.cancelBubble != "unknown" && (n.cancelBubble = !0), this.isPropagationStopped = go);
      },
      persist: function() {
      },
      isPersistent: go
    }), e;
  }
  var fi = {
    eventPhase: 0,
    bubbles: 0,
    cancelable: 0,
    timeStamp: function(t) {
      return t.timeStamp || Date.now();
    },
    defaultPrevented: 0,
    isTrusted: 0
  }, yo = ze(fi), Ql = z({}, fi, { view: 0, detail: 0 }), eT = ze(Ql), Bu, Hu, Zl, vo = z({}, Ql, {
    screenX: 0,
    screenY: 0,
    clientX: 0,
    clientY: 0,
    pageX: 0,
    pageY: 0,
    ctrlKey: 0,
    shiftKey: 0,
    altKey: 0,
    metaKey: 0,
    getModifierState: Gu,
    button: 0,
    buttons: 0,
    relatedTarget: function(t) {
      return t.relatedTarget === void 0 ? t.fromElement === t.srcElement ? t.toElement : t.fromElement : t.relatedTarget;
    },
    movementX: function(t) {
      return "movementX" in t ? t.movementX : (t !== Zl && (Zl && t.type === "mousemove" ? (Bu = t.screenX - Zl.screenX, Hu = t.screenY - Zl.screenY) : Hu = Bu = 0, Zl = t), Bu);
    },
    movementY: function(t) {
      return "movementY" in t ? t.movementY : Hu;
    }
  }), Om = ze(vo), nT = z({}, vo, { dataTransfer: 0 }), iT = ze(nT), aT = z({}, Ql, { relatedTarget: 0 }), ju = ze(aT), lT = z({}, fi, {
    animationName: 0,
    elapsedTime: 0,
    pseudoElement: 0
  }), sT = ze(lT), oT = z({}, fi, {
    clipboardData: function(t) {
      return "clipboardData" in t ? t.clipboardData : window.clipboardData;
    }
  }), rT = ze(oT), uT = z({}, fi, { data: 0 }), zm = ze(uT), cT = {
    Esc: "Escape",
    Spacebar: " ",
    Left: "ArrowLeft",
    Up: "ArrowUp",
    Right: "ArrowRight",
    Down: "ArrowDown",
    Del: "Delete",
    Win: "OS",
    Menu: "ContextMenu",
    Apps: "ContextMenu",
    Scroll: "ScrollLock",
    MozPrintableKey: "Unidentified"
  }, fT = {
    8: "Backspace",
    9: "Tab",
    12: "Clear",
    13: "Enter",
    16: "Shift",
    17: "Control",
    18: "Alt",
    19: "Pause",
    20: "CapsLock",
    27: "Escape",
    32: " ",
    33: "PageUp",
    34: "PageDown",
    35: "End",
    36: "Home",
    37: "ArrowLeft",
    38: "ArrowUp",
    39: "ArrowRight",
    40: "ArrowDown",
    45: "Insert",
    46: "Delete",
    112: "F1",
    113: "F2",
    114: "F3",
    115: "F4",
    116: "F5",
    117: "F6",
    118: "F7",
    119: "F8",
    120: "F9",
    121: "F10",
    122: "F11",
    123: "F12",
    144: "NumLock",
    145: "ScrollLock",
    224: "Meta"
  }, dT = {
    Alt: "altKey",
    Control: "ctrlKey",
    Meta: "metaKey",
    Shift: "shiftKey"
  };
  function hT(t) {
    var e = this.nativeEvent;
    return e.getModifierState ? e.getModifierState(t) : (t = dT[t]) ? !!e[t] : !1;
  }
  function Gu() {
    return hT;
  }
  var mT = z({}, Ql, {
    key: function(t) {
      if (t.key) {
        var e = cT[t.key] || t.key;
        if (e !== "Unidentified") return e;
      }
      return t.type === "keypress" ? (t = po(t), t === 13 ? "Enter" : String.fromCharCode(t)) : t.type === "keydown" || t.type === "keyup" ? fT[t.keyCode] || "Unidentified" : "";
    },
    code: 0,
    location: 0,
    ctrlKey: 0,
    shiftKey: 0,
    altKey: 0,
    metaKey: 0,
    repeat: 0,
    locale: 0,
    getModifierState: Gu,
    charCode: function(t) {
      return t.type === "keypress" ? po(t) : 0;
    },
    keyCode: function(t) {
      return t.type === "keydown" || t.type === "keyup" ? t.keyCode : 0;
    },
    which: function(t) {
      return t.type === "keypress" ? po(t) : t.type === "keydown" || t.type === "keyup" ? t.keyCode : 0;
    }
  }), pT = ze(mT), gT = z({}, vo, {
    pointerId: 0,
    width: 0,
    height: 0,
    pressure: 0,
    tangentialPressure: 0,
    tiltX: 0,
    tiltY: 0,
    twist: 0,
    pointerType: 0,
    isPrimary: 0
  }), Rm = ze(gT), yT = z({}, fi, { submitter: 0 }), vT = ze(yT), bT = z({}, Ql, {
    touches: 0,
    targetTouches: 0,
    changedTouches: 0,
    altKey: 0,
    metaKey: 0,
    ctrlKey: 0,
    shiftKey: 0,
    getModifierState: Gu
  }), ST = ze(bT), TT = z({}, fi, {
    propertyName: 0,
    elapsedTime: 0,
    pseudoElement: 0
  }), ET = ze(TT), AT = z({}, vo, {
    deltaX: function(t) {
      return "deltaX" in t ? t.deltaX : "wheelDeltaX" in t ? -t.wheelDeltaX : 0;
    },
    deltaY: function(t) {
      return "deltaY" in t ? t.deltaY : "wheelDeltaY" in t ? -t.wheelDeltaY : "wheelDelta" in t ? -t.wheelDelta : 0;
    },
    deltaZ: 0,
    deltaMode: 0
  }), xT = ze(AT), MT = z({}, fi, {
    newState: 0,
    oldState: 0,
    source: 0
  }), wT = ze(MT), CT = [9, 13, 27, 32], Yu = Qn && "CompositionEvent" in window, Kl = null;
  Qn && "documentMode" in document && (Kl = document.documentMode);
  var DT = Qn && "TextEvent" in window && !Kl, Nm = Qn && (!Yu || Kl && 8 < Kl && 11 >= Kl), _m = " ", Vm = !1;
  function Lm(t, e) {
    switch (t) {
      case "keyup":
        return CT.indexOf(e.keyCode) !== -1;
      case "keydown":
        return e.keyCode !== 229;
      case "keypress":
      case "mousedown":
      case "focusout":
        return !0;
      default:
        return !1;
    }
  }
  function Um(t) {
    return t = t.detail, typeof t == "object" && "data" in t ? t.data : null;
  }
  var Ba = !1;
  function OT(t, e) {
    switch (t) {
      case "compositionend":
        return Um(e);
      case "keypress":
        return e.which !== 32 ? null : (Vm = !0, _m);
      case "textInput":
        return t = e.data, t === _m && Vm ? null : t;
      default:
        return null;
    }
  }
  function zT(t, e) {
    if (Ba)
      return t === "compositionend" || !Yu && Lm(t, e) ? (t = Cm(), mo = Uu = ci = null, Ba = !1, t) : null;
    switch (t) {
      case "paste":
        return null;
      case "keypress":
        if (!(e.ctrlKey || e.altKey || e.metaKey) || e.ctrlKey && e.altKey) {
          if (e.char && 1 < e.char.length)
            return e.char;
          if (e.which) return String.fromCharCode(e.which);
        }
        return null;
      case "compositionend":
        return Nm && e.locale !== "ko" ? null : e.data;
      default:
        return null;
    }
  }
  var RT = {
    color: !0,
    date: !0,
    datetime: !0,
    "datetime-local": !0,
    email: !0,
    month: !0,
    number: !0,
    password: !0,
    range: !0,
    search: !0,
    tel: !0,
    text: !0,
    time: !0,
    url: !0,
    week: !0
  };
  function Bm(t) {
    var e = t && t.nodeName && t.nodeName.toLowerCase();
    return e === "input" ? !!RT[t.type] : e === "textarea";
  }
  function Hm(t, e, n, l) {
    La ? Ua ? Ua.push(l) : Ua = [l] : La = l, e = br(e, "onChange"), 0 < e.length && (n = new yo(
      "onChange",
      "change",
      null,
      n,
      l
    ), t.push({ event: n, listeners: e }));
  }
  var kl = null, Pl = null;
  function NT(t) {
    My(t, 0);
  }
  function bo(t) {
    var e = Yl(t);
    if (bm(e)) return t;
  }
  function jm(t, e) {
    if (t === "change") return e;
  }
  var Gm = !1;
  if (Qn) {
    var qu;
    if (Qn) {
      var Xu = "oninput" in document;
      if (!Xu) {
        var Ym = document.createElement("div");
        Ym.setAttribute("oninput", "return;"), Xu = typeof Ym.oninput == "function";
      }
      qu = Xu;
    } else qu = !1;
    Gm = qu && (!document.documentMode || 9 < document.documentMode);
  }
  function qm() {
    kl && (kl.detachEvent("onpropertychange", Xm), Pl = kl = null);
  }
  function Xm(t) {
    if (t.propertyName === "value" && bo(Pl)) {
      var e = [];
      Hm(
        e,
        Pl,
        t,
        _u(t)
      ), wm(NT, e);
    }
  }
  function _T(t, e, n) {
    t === "focusin" ? (qm(), kl = e, Pl = n, kl.attachEvent("onpropertychange", Xm)) : t === "focusout" && qm();
  }
  function VT(t) {
    if (t === "selectionchange" || t === "keyup" || t === "keydown")
      return bo(Pl);
  }
  function LT(t, e) {
    if (t === "click") return bo(e);
  }
  function UT(t, e) {
    if (t === "input" || t === "change")
      return bo(e);
  }
  function BT(t, e) {
    return t === e && (t !== 0 || 1 / t === 1 / e) || t !== t && e !== e;
  }
  var Ke = typeof Object.is == "function" ? Object.is : BT;
  function Jl(t, e) {
    if (Ke(t, e)) return !0;
    if (typeof t != "object" || t === null || typeof e != "object" || e === null)
      return !1;
    var n = Object.keys(t), l = Object.keys(e);
    if (n.length !== l.length) return !1;
    for (l = 0; l < n.length; l++) {
      var r = n[l];
      if (!Rl.call(e, r) || !Ke(t[r], e[r]))
        return !1;
    }
    return !0;
  }
  function Qu(t) {
    if (t = t || (typeof document < "u" ? document : void 0), typeof t > "u") return null;
    try {
      return t.activeElement || t.body;
    } catch {
      return t.body;
    }
  }
  function Qm(t) {
    for (; t && t.firstChild; ) t = t.firstChild;
    return t;
  }
  function Zm(t, e) {
    var n = Qm(t);
    t = 0;
    for (var l; n; ) {
      if (n.nodeType === 3) {
        if (l = t + n.textContent.length, t <= e && l >= e)
          return { node: n, offset: e - t };
        t = l;
      }
      t: {
        for (; n; ) {
          if (n.nextSibling) {
            n = n.nextSibling;
            break t;
          }
          n = n.parentNode;
        }
        n = void 0;
      }
      n = Qm(n);
    }
  }
  function Km(t, e) {
    return t && e ? t === e ? !0 : t && t.nodeType === 3 ? !1 : e && e.nodeType === 3 ? Km(t, e.parentNode) : "contains" in t ? t.contains(e) : t.compareDocumentPosition ? !!(t.compareDocumentPosition(e) & 16) : !1 : !1;
  }
  function km(t) {
    t = t != null && t.ownerDocument != null && t.ownerDocument.defaultView != null ? t.ownerDocument.defaultView : window;
    for (var e = Qu(t.document); e instanceof t.HTMLIFrameElement; ) {
      try {
        var n = typeof e.contentWindow.location.href == "string";
      } catch {
        n = !1;
      }
      if (n) t = e.contentWindow;
      else break;
      e = Qu(t.document);
    }
    return e;
  }
  function Zu(t) {
    var e = t && t.nodeName && t.nodeName.toLowerCase();
    return e && (e === "input" && (t.type === "text" || t.type === "search" || t.type === "tel" || t.type === "url" || t.type === "password") || e === "textarea" || t.contentEditable === "true");
  }
  var HT = Qn && "documentMode" in document && 11 >= document.documentMode, Ha = null, Ku = null, Fl = null, ku = !1;
  function Pm(t, e, n) {
    var l = n.window === n ? n.document : n.nodeType === 9 ? n : n.ownerDocument;
    ku || Ha == null || Ha !== Qu(l) || (l = Ha, "selectionStart" in l && Zu(l) ? l = { start: l.selectionStart, end: l.selectionEnd } : (l = (l.ownerDocument && l.ownerDocument.defaultView || window).getSelection(), l = {
      anchorNode: l.anchorNode,
      anchorOffset: l.anchorOffset,
      focusNode: l.focusNode,
      focusOffset: l.focusOffset
    }), Fl && Jl(Fl, l) || (Fl = l, l = br(Ku, "onSelect"), 0 < l.length && (e = new yo(
      "onSelect",
      "select",
      null,
      e,
      n
    ), t.push({ event: e, listeners: l }), e.target = Ha)));
  }
  function Ji(t, e) {
    var n = {};
    return n[t.toLowerCase()] = e.toLowerCase(), n["Webkit" + t] = "webkit" + e, n["Moz" + t] = "moz" + e, n;
  }
  var ja = {
    animationend: Ji("Animation", "AnimationEnd"),
    animationiteration: Ji("Animation", "AnimationIteration"),
    animationstart: Ji("Animation", "AnimationStart"),
    transitionrun: Ji("Transition", "TransitionRun"),
    transitionstart: Ji("Transition", "TransitionStart"),
    transitioncancel: Ji("Transition", "TransitionCancel"),
    transitionend: Ji("Transition", "TransitionEnd")
  }, Pu = {}, Jm = {};
  Qn && (Jm = document.createElement("div").style, "AnimationEvent" in window || (delete ja.animationend.animation, delete ja.animationiteration.animation, delete ja.animationstart.animation), "TransitionEvent" in window || delete ja.transitionend.transition);
  function Fi(t) {
    if (Pu[t]) return Pu[t];
    if (!ja[t]) return t;
    var e = ja[t], n;
    for (n in e)
      if (e.hasOwnProperty(n) && n in Jm)
        return Pu[t] = e[n];
    return t;
  }
  var Fm = Fi("animationend"), Im = Fi("animationiteration"), Wm = Fi("animationstart"), jT = Fi("transitionrun"), GT = Fi("transitionstart"), YT = Fi("transitioncancel"), $m = Fi("transitionend"), tp = /* @__PURE__ */ new Map(), Ju = "abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error fullscreenChange fullscreenError gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(
    " "
  );
  Ju.push("scrollEnd");
  function hn(t, e) {
    tp.set(t, e), Pi(e, [t]);
  }
  var qT = 0;
  function Zn(t, e) {
    if (t.name != null && t.name !== "auto") return t.name;
    if (e.autoName !== null) return e.autoName;
    t = yn.identifierPrefix;
    var n = qT++;
    return t = "_" + t + "t_" + n.toString(32) + "_", e.autoName = t;
  }
  function ep(t) {
    if (t == null || typeof t == "string")
      return t;
    var e = null, n = ll;
    if (n !== null)
      for (var l = 0; l < n.length; l++) {
        var r = t[n[l]];
        if (r != null) {
          if (r === "none") return "none";
          e = e == null ? r : e + (" " + r);
        }
      }
    return e ?? t.default;
  }
  function Kn(t, e) {
    return t = ep(t), e = ep(e), e == null ? t === "auto" ? null : t : e === "auto" ? null : e;
  }
  var So = typeof reportError == "function" ? reportError : function(t) {
    if (typeof window == "object" && typeof window.ErrorEvent == "function") {
      var e = new window.ErrorEvent("error", {
        bubbles: !0,
        cancelable: !0,
        message: typeof t == "object" && t !== null && typeof t.message == "string" ? String(t.message) : String(t),
        error: t
      });
      if (!window.dispatchEvent(e)) return;
    } else if (typeof process == "object" && typeof process.emit == "function") {
      process.emit("uncaughtException", t);
      return;
    }
    console.error(t);
  }, an = [], Ga = 0, Fu = 0;
  function To() {
    for (var t = Ga, e = Fu = Ga = 0; e < t; ) {
      var n = an[e];
      an[e++] = null;
      var l = an[e];
      an[e++] = null;
      var r = an[e];
      an[e++] = null;
      var u = an[e];
      if (an[e++] = null, l !== null && r !== null) {
        var m = l.pending;
        m === null ? r.next = r : (r.next = m.next, m.next = r), l.pending = r;
      }
      u !== 0 && np(n, r, u);
    }
  }
  function Eo(t, e, n, l) {
    an[Ga++] = t, an[Ga++] = e, an[Ga++] = n, an[Ga++] = l, Fu |= l, t.lanes |= l, t = t.alternate, t !== null && (t.lanes |= l);
  }
  function Iu(t, e, n, l) {
    return Eo(t, e, n, l), Ao(t);
  }
  function Ii(t, e) {
    return Eo(t, null, null, e), Ao(t);
  }
  function np(t, e, n) {
    t.lanes |= n;
    var l = t.alternate;
    l !== null && (l.lanes |= n);
    for (var r = !1, u = t.return; u !== null; )
      u.childLanes |= n, l = u.alternate, l !== null && (l.childLanes |= n), u.tag === 22 && (t = u.stateNode, t === null || t._visibility & 1 || (r = !0)), t = u, u = u.return;
    return t.tag === 3 ? (u = t.stateNode, r && e !== null && (r = 31 - Qe(n), t = u.hiddenUpdates, l = t[r], l === null ? t[r] = [e] : l.push(e), e.lane = n | 536870912), u) : null;
  }
  function Ao(t) {
    if (50 < vs)
      throw vs = 0, dr = null, Error(o(185));
    for (var e = t.return; e !== null; )
      t = e, e = t.return;
    return t.tag === 3 ? t.stateNode : null;
  }
  var Ya = {};
  function XT(t, e, n, l) {
    this.tag = t, this.key = n, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = e, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = l, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
  }
  function Ue(t, e, n, l) {
    return new XT(t, e, n, l);
  }
  function Wu(t) {
    return t = t.prototype, !(!t || !t.isReactComponent);
  }
  function kn(t, e) {
    var n = t.alternate;
    return n === null ? (n = Ue(
      t.tag,
      e,
      t.key,
      t.mode
    ), n.elementType = t.elementType, n.type = t.type, n.stateNode = t.stateNode, n.alternate = t, t.alternate = n) : (n.pendingProps = e, n.type = t.type, n.flags = 0, n.subtreeFlags = 0, n.deletions = null), n.flags = t.flags & 1206910976, n.childLanes = t.childLanes, n.lanes = t.lanes, n.child = t.child, n.memoizedProps = t.memoizedProps, n.memoizedState = t.memoizedState, n.updateQueue = t.updateQueue, e = t.dependencies, n.dependencies = e === null ? null : { lanes: e.lanes, firstContext: e.firstContext }, n.sibling = t.sibling, n.index = t.index, n.ref = t.ref, n.refCleanup = t.refCleanup, n;
  }
  function ip(t, e) {
    t.flags &= 1206910978;
    var n = t.alternate;
    return n === null ? (t.childLanes = 0, t.lanes = e, t.child = null, t.subtreeFlags = 0, t.memoizedProps = null, t.memoizedState = null, t.updateQueue = null, t.dependencies = null, t.stateNode = null) : (t.childLanes = n.childLanes, t.lanes = n.lanes, t.child = n.child, t.subtreeFlags = 0, t.deletions = null, t.memoizedProps = n.memoizedProps, t.memoizedState = n.memoizedState, t.updateQueue = n.updateQueue, t.type = n.type, e = n.dependencies, t.dependencies = e === null ? null : {
      lanes: e.lanes,
      firstContext: e.firstContext
    }), t;
  }
  function xo(t, e, n, l, r, u) {
    var m = 0;
    if (l = t, typeof l == "function") Wu(l) && (m = 1);
    else if (typeof l == "string")
      m = yA(
        t,
        n,
        ie.current
      ) ? 26 : t === "html" || t === "head" || t === "body" ? 27 : 5;
    else
      t: switch (l) {
        case K:
          return t = Ue(31, n, e, r), t.elementType = K, t.lanes = u, t;
        case st:
          return Wi(n.children, r, u, e);
        case dt:
          m = 8, r |= 24;
          break;
        case vt:
          return t = Ue(12, n, e, r | 2), t.elementType = vt, t.lanes = u, t;
        case rt:
          return t = Ue(13, n, e, r), t.elementType = rt, t.lanes = u, t;
        case ut:
          return t = Ue(19, n, e, r), t.elementType = ut, t.lanes = u, t;
        case $:
        case T:
          return t = r | 32, t = Ue(30, n, e, t), t.elementType = T, t.lanes = u, t.stateNode = {
            autoName: null,
            paired: null,
            clones: null,
            ref: null
          }, t;
        default:
          if (typeof l == "object" && l !== null)
            switch (l.$$typeof) {
              case St:
                m = 10;
                break t;
              case xt:
                m = 9;
                break t;
              case F:
                m = 11;
                break t;
              case nt:
                m = 14;
                break t;
              case L:
                m = 16, l = null;
                break t;
            }
          m = 29, n = Error(
            o(130, t === null ? "null" : typeof t, "")
          ), l = null;
      }
    return e = Ue(m, n, e, r), e.elementType = t, e.type = l, e.lanes = u, e;
  }
  function Wi(t, e, n, l) {
    return t = Ue(7, t, l, e), t.lanes = n, t;
  }
  function $u(t, e, n) {
    return t = Ue(6, t, null, e), t.lanes = n, t;
  }
  function ap(t) {
    var e = Ue(18, null, null, 0);
    return e.stateNode = t, e;
  }
  function tc(t, e, n) {
    return e = Ue(
      4,
      t.children !== null ? t.children : [],
      t.key,
      e
    ), e.lanes = n, e.stateNode = {
      containerInfo: t.containerInfo,
      pendingChildren: null,
      implementation: t.implementation
    }, e;
  }
  var lp = /* @__PURE__ */ new WeakMap();
  function ln(t, e) {
    if (typeof t == "object" && t !== null) {
      var n = lp.get(t);
      return n !== void 0 ? n : (e = {
        value: t,
        source: e,
        stack: Qi(e)
      }, lp.set(t, e), e);
    }
    return {
      value: t,
      source: e,
      stack: Qi(e)
    };
  }
  var qa = [], Xa = 0, Mo = null, Il = 0, sn = [], on = 0, di = null, Dn = 1, On = "";
  function Pn(t, e) {
    qa[Xa++] = Il, qa[Xa++] = Mo, Mo = t, Il = e;
  }
  function sp(t, e, n) {
    sn[on++] = Dn, sn[on++] = On, sn[on++] = di, di = t;
    var l = Dn;
    t = On;
    var r = 32 - Qe(l) - 1;
    l &= ~(1 << r), n += 1;
    var u = 32 - Qe(e) + r;
    if (30 < u) {
      var m = r - r % 5;
      u = (l & (1 << m) - 1).toString(32), l >>= m, r -= m, Dn = 1 << 32 - Qe(e) + r | n << r | l, On = u + t;
    } else
      Dn = 1 << u | n << r | l, On = t;
  }
  function wo(t) {
    t.return !== null && (Pn(t, 1), sp(t, 1, 0));
  }
  function ec(t) {
    for (; t === Mo; )
      Mo = qa[--Xa], qa[Xa] = null, Il = qa[--Xa], qa[Xa] = null;
    for (; t === di; )
      di = sn[--on], sn[on] = null, On = sn[--on], sn[on] = null, Dn = sn[--on], sn[on] = null;
  }
  function op(t, e) {
    sn[on++] = Dn, sn[on++] = On, sn[on++] = di, Dn = e.id, On = e.overflow, di = t;
  }
  var ge = null, Ft = null, Dt = !1, hi = null, rn = !1, nc = Error(o(519));
  function mi(t) {
    var e = Error(
      o(
        418,
        1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML",
        ""
      )
    );
    throw Wl(ln(e, t)), nc;
  }
  function rp(t) {
    var e = t.stateNode, n = t.type, l = t.memoizedProps;
    switch (e[be] = t, e[Le] = l, n) {
      case "dialog":
        Nt("cancel", e), Nt("close", e);
        break;
      case "iframe":
      case "object":
      case "embed":
        Nt("load", e);
        break;
      case "video":
      case "audio":
        for (n = 0; n < Ss.length; n++)
          Nt(Ss[n], e);
        break;
      case "source":
        Nt("error", e);
        break;
      case "img":
      case "image":
      case "link":
        Nt("error", e), Nt("load", e);
        break;
      case "details":
        Nt("toggle", e);
        break;
      case "input":
        Nt("invalid", e), Sm(
          e,
          l.value,
          l.defaultValue,
          l.checked,
          l.defaultChecked,
          l.type,
          l.name,
          !0
        );
        break;
      case "select":
        Nt("invalid", e);
        break;
      case "textarea":
        Nt("invalid", e), Em(e, l.value, l.defaultValue, l.children);
    }
    n = l.children, typeof n != "string" && typeof n != "number" && typeof n != "bigint" || e.textContent === "" + n || l.suppressHydrationWarning === !0 || Oy(e.textContent, n) ? (l.popover != null && (Nt("beforetoggle", e), Nt("toggle", e)), l.onScroll != null && Nt("scroll", e), l.onScrollEnd != null && Nt("scrollend", e), l.onClick != null && (e.onclick = Cn), e = !0) : e = !1, e || mi(t, !0);
  }
  function Co(t) {
    for (ge = t.return; ge; )
      switch (ge.tag) {
        case 5:
        case 31:
        case 13:
          rn = !1;
          return;
        case 27:
        case 3:
          rn = !0;
          return;
        default:
          ge = ge.return;
      }
  }
  function Qa(t) {
    if (t !== ge) return !1;
    if (!Dt) return Co(t), Dt = !0, !1;
    var e = t.tag, n;
    if ((n = e !== 3 && e !== 27) && ((n = e === 5) && (n = t.type, n = !(n !== "form" && n !== "button") || _f(t.type, t.memoizedProps)), n = !n), n && Ft && mi(t), Co(t), e === 13) {
      if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(o(317));
      Ft = Py(t);
    } else if (e === 31) {
      if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(o(317));
      Ft = Py(t);
    } else
      e === 27 ? (e = Ft, zi(t.type) ? (t = qf, qf = null, Ft = t) : Ft = e) : Ft = ge ? cn(t.stateNode.nextSibling) : null;
    return !0;
  }
  function $i() {
    Ft = ge = null, Dt = !1;
  }
  function ic() {
    var t = hi;
    return t !== null && (je === null ? je = t : je.push.apply(
      je,
      t
    ), hi = null), t;
  }
  function Wl(t) {
    hi === null ? hi = [t] : hi.push(t);
  }
  var ac = Ht(null), ta = null, Jn = null;
  function pi(t, e, n) {
    Mt(ac, e._currentValue), e._currentValue = n;
  }
  function Fn(t) {
    t._currentValue = ac.current, Ut(ac);
  }
  function Do(t, e, n) {
    for (; t !== null; ) {
      var l = t.alternate;
      if ((t.childLanes & e) !== e ? (t.childLanes |= e, l !== null && (l.childLanes |= e)) : l !== null && (l.childLanes & e) !== e && (l.childLanes |= e), t === n) break;
      t = t.return;
    }
  }
  function lc(t, e, n, l) {
    var r = t.child;
    for (r !== null && (r.return = t); r !== null; ) {
      var u = r.dependencies;
      if (u !== null) {
        var m = r.child;
        u = u.firstContext;
        t: for (; u !== null; ) {
          var b = u;
          u = r;
          for (var x = 0; x < e.length; x++)
            if (b.context === e[x]) {
              u.lanes |= n, b = u.alternate, b !== null && (b.lanes |= n), Do(
                u.return,
                n,
                t
              ), l || (m = null);
              break t;
            }
          u = b.next;
        }
      } else if (r.tag === 18) {
        if (m = r.return, m === null) throw Error(o(341));
        m.lanes |= n, u = m.alternate, u !== null && (u.lanes |= n), Do(m, n, t), m = null;
      } else
        r.tag === 13 && r.memoizedState !== null && r.memoizedState.dehydrated === null ? (r.lanes |= n, m = r.alternate, m !== null && (m.lanes |= n), Do(
          r.return,
          n,
          t
        ), m = r.child, m = m !== null ? m.sibling : null) : m = r.child;
      if (m !== null) m.return = r;
      else
        for (m = r; m !== null; ) {
          if (m === t) {
            m = null;
            break;
          }
          if (r = m.sibling, r !== null) {
            r.return = m.return, m = r;
            break;
          }
          m = m.return;
        }
      r = m;
    }
  }
  function ea(t, e, n, l) {
    t = null;
    for (var r = e, u = !1; r !== null; ) {
      if (!u) {
        if ((r.flags & 524288) !== 0) u = !0;
        else if ((r.flags & 262144) !== 0) break;
      }
      if (r.tag === 10) {
        var m = r.alternate;
        if (m === null) throw Error(o(387));
        if (m = m.memoizedProps, m !== null) {
          var b = r.type;
          Ke(r.pendingProps.value, m.value) || (t !== null ? t.push(b) : t = [b]);
        }
      } else if (r === oi.current) {
        if (m = r.alternate, m === null) throw Error(o(387));
        m.memoizedState.memoizedState !== r.memoizedState.memoizedState && (t !== null ? t.push(pl) : t = [pl]);
      }
      r = r.return;
    }
    return t !== null && lc(
      e,
      t,
      n,
      l
    ), e.flags |= 262144, t !== null;
  }
  function Oo(t) {
    for (t = t.firstContext; t !== null; ) {
      if (!Ke(
        t.context._currentValue,
        t.memoizedValue
      ))
        return !0;
      t = t.next;
    }
    return !1;
  }
  function na(t) {
    ta = t, Jn = null, t = t.dependencies, t !== null && (t.firstContext = null);
  }
  function Se(t) {
    return up(ta, t);
  }
  function zo(t, e) {
    return ta === null && na(t), up(t, e);
  }
  function up(t, e) {
    var n = e._currentValue;
    if (e = { context: e, memoizedValue: n, next: null }, Jn === null) {
      if (t === null) throw Error(o(308));
      Jn = e, t.dependencies = { lanes: 0, firstContext: e }, t.flags |= 524288;
    } else Jn = Jn.next = e;
    return n;
  }
  var QT = typeof AbortController < "u" ? AbortController : function() {
    var t = [], e = this.signal = {
      aborted: !1,
      addEventListener: function(n, l) {
        t.push(l);
      }
    };
    this.abort = function() {
      e.aborted = !0, t.forEach(function(n) {
        return n();
      });
    };
  }, ZT = i.unstable_scheduleCallback, KT = i.unstable_NormalPriority, se = {
    $$typeof: St,
    Consumer: null,
    Provider: null,
    _currentValue: null,
    _currentValue2: null,
    _threadCount: 0
  };
  function sc() {
    return {
      controller: new QT(),
      data: /* @__PURE__ */ new Map(),
      refCount: 0
    };
  }
  function $l(t) {
    t.refCount--, t.refCount === 0 && ZT(KT, function() {
      t.controller.abort();
    });
  }
  function cp(t, e) {
    if ((t.pendingLanes & 4194048) !== 0) {
      var n = t.transitionTypes;
      for (n === null && (n = t.transitionTypes = []), t = 0; t < e.length; t++) {
        var l = e[t];
        n.indexOf(l) === -1 && n.push(l);
      }
    }
  }
  var ts = null;
  function kT(t) {
    var e = t.transitionTypes;
    return t.transitionTypes = null, e;
  }
  var es = null, oc = 0, ia = 0, Za = null;
  function PT(t, e) {
    if (es === null) {
      var n = es = [];
      oc = 0, ia = xf(), Za = {
        status: "pending",
        value: void 0,
        then: function(l) {
          n.push(l);
        }
      };
    }
    return oc++, e.then(fp, fp), e;
  }
  function fp() {
    if (--oc === 0 && (ts = null, es !== null)) {
      Za !== null && (Za.status = "fulfilled");
      var t = es;
      es = null, ia = 0, Za = null;
      for (var e = 0; e < t.length; e++) (0, t[e])();
    }
  }
  function JT(t, e) {
    var n = [], l = {
      status: "pending",
      value: null,
      reason: null,
      then: function(r) {
        n.push(r);
      }
    };
    return t.then(
      function() {
        l.status = "fulfilled", l.value = e;
        for (var r = 0; r < n.length; r++) (0, n[r])(e);
      },
      function(r) {
        for (l.status = "rejected", l.reason = r, r = 0; r < n.length; r++)
          (0, n[r])(void 0);
      }
    ), l;
  }
  var dp = P.S;
  P.S = function(t, e) {
    if (ay = we(), typeof e == "object" && e !== null && typeof e.then == "function" && PT(t, e), ts !== null)
      for (var n = ul; n !== null; )
        cp(n, ts), n = n.next;
    if (n = t.types, n !== null) {
      for (var l = ul; l !== null; )
        cp(l, n), l = l.next;
      if (ia !== 0) {
        l = ts, l === null && (l = ts = []);
        for (var r = 0; r < n.length; r++) {
          var u = n[r];
          l.indexOf(u) === -1 && l.push(u);
        }
      }
    }
    dp !== null && dp(t, e);
  };
  var aa = Ht(null);
  function rc() {
    var t = aa.current;
    return t !== null ? t : Pt.pooledCache;
  }
  function Ro(t, e) {
    e === null ? Mt(aa, aa.current) : Mt(aa, e.pool);
  }
  function hp() {
    var t = rc();
    return t === null ? null : { parent: se._currentValue, pool: t };
  }
  var Ka = Error(o(460)), uc = Error(o(474)), No = Error(o(542)), _o = { then: function() {
  } };
  function mp(t) {
    return t = t.status, t === "fulfilled" || t === "rejected";
  }
  function pp(t, e, n) {
    switch (n = t[n], n === void 0 ? t.push(e) : n !== e && (e.then(Cn, Cn), e = n), e.status) {
      case "fulfilled":
        return e.value;
      case "rejected":
        throw t = e.reason, yp(t), t === void 0 && !("reason" in e) ? Error(o(600)) : t;
      default:
        if (typeof e.status == "string") e.then(Cn, Cn);
        else {
          if (t = Pt, t !== null && 100 < t.shellSuspendCounter)
            throw Error(o(482));
          t = e, t.status = "pending", t.then(
            function(l) {
              if (e.status === "pending") {
                var r = e;
                r.status = "fulfilled", r.value = l;
              }
            },
            function(l) {
              if (e.status === "pending") {
                var r = e;
                r.status = "rejected", r.reason = l;
              }
            }
          );
        }
        switch (e.status) {
          case "fulfilled":
            return e.value;
          case "rejected":
            throw t = e.reason, yp(t), t;
        }
        throw sa = e, Ka;
    }
  }
  function la(t) {
    try {
      var e = t._init;
      return e(t._payload);
    } catch (n) {
      throw n !== null && typeof n == "object" && typeof n.then == "function" ? (sa = n, Ka) : n;
    }
  }
  var sa = null;
  function gp() {
    if (sa === null) throw Error(o(459));
    var t = sa;
    return sa = null, t;
  }
  function yp(t) {
    if (t === Ka || t === No)
      throw Error(o(483));
  }
  var ka = null, ns = 0;
  function Vo(t) {
    var e = ns;
    return ns += 1, ka === null && (ka = []), pp(ka, t, e);
  }
  function gi(t, e) {
    e = e.props.ref, t.ref = e !== void 0 ? e : null;
  }
  function Lo(t, e) {
    throw e.$$typeof === D ? Error(o(525)) : (t = Object.prototype.toString.call(e), Error(
      o(
        31,
        t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t
      )
    ));
  }
  function vp(t) {
    function e(_, O) {
      if (t) {
        var B = _.deletions;
        B === null ? (_.deletions = [O], _.flags |= 16) : B.push(O);
      }
    }
    function n(_, O) {
      if (!t) return null;
      for (; O !== null; )
        e(_, O), O = O.sibling;
      return null;
    }
    function l(_) {
      for (var O = /* @__PURE__ */ new Map(); _ !== null; )
        _.key === null ? O.set(_.index, _) : O.set(_.key, _), _ = _.sibling;
      return O;
    }
    function r(_, O) {
      return _ = kn(_, O), _.index = 0, _.sibling = null, _;
    }
    function u(_, O, B) {
      return _.index = B, t ? (B = _.alternate, B !== null ? (B = B.index, B < O ? (_.flags |= 2, O) : B) : (_.flags |= 134217730, O)) : (_.flags |= 1048576, O);
    }
    function m(_) {
      return t && _.alternate === null && (_.flags |= 134217730), _;
    }
    function b(_, O, B, Q) {
      return O === null || O.tag !== 6 ? (O = $u(B, _.mode, Q), O.return = _, O) : (O = r(O, B), O.return = _, O);
    }
    function x(_, O, B, Q) {
      var ht = B.type;
      return ht === st ? (_ = Y(
        _,
        O,
        B.props.children,
        Q,
        B.key
      ), gi(_, B), _) : O !== null && (O.elementType === ht || typeof ht == "object" && ht !== null && ht.$$typeof === L && la(ht) === O.type) ? (O = r(O, B.props), gi(O, B), O.return = _, O) : (O = xo(
        B.type,
        B.key,
        B.props,
        null,
        _.mode,
        Q
      ), gi(O, B), O.return = _, O);
    }
    function V(_, O, B, Q) {
      return O === null || O.tag !== 4 || O.stateNode.containerInfo !== B.containerInfo || O.stateNode.implementation !== B.implementation ? (O = tc(B, _.mode, Q), O.return = _, O) : (O = r(O, B.children || []), O.return = _, O);
    }
    function Y(_, O, B, Q, ht) {
      return O === null || O.tag !== 7 ? (O = Wi(
        B,
        _.mode,
        Q,
        ht
      ), O.return = _, O) : (O = r(O, B), O.return = _, O);
    }
    function Z(_, O, B) {
      if (typeof O == "string" && O !== "" || typeof O == "number" || typeof O == "bigint")
        return O = $u(
          "" + O,
          _.mode,
          B
        ), O.return = _, O;
      if (typeof O == "object" && O !== null) {
        switch (O.$$typeof) {
          case at:
            return B = xo(
              O.type,
              O.key,
              O.props,
              null,
              _.mode,
              B
            ), gi(B, O), B.return = _, B;
          case lt:
            return O = tc(
              O,
              _.mode,
              B
            ), O.return = _, O;
          case L:
            return O = la(O), Z(_, O, B);
        }
        if (ft(O) || J(O))
          return O = Wi(
            O,
            _.mode,
            B,
            null
          ), O.return = _, O;
        if (typeof O.then == "function")
          return Z(_, Vo(O), B);
        if (O.$$typeof === St)
          return Z(
            _,
            zo(_, O),
            B
          );
        Lo(_, O);
      }
      return null;
    }
    function R(_, O, B, Q) {
      var ht = O !== null ? O.key : null;
      if (typeof B == "string" && B !== "" || typeof B == "number" || typeof B == "bigint")
        return ht !== null ? null : b(_, O, "" + B, Q);
      if (typeof B == "object" && B !== null) {
        switch (B.$$typeof) {
          case at:
            return B.key === ht ? x(_, O, B, Q) : null;
          case lt:
            return B.key === ht ? V(_, O, B, Q) : null;
          case L:
            return B = la(B), R(_, O, B, Q);
        }
        if (ft(B) || J(B))
          return ht !== null ? null : Y(_, O, B, Q, null);
        if (typeof B.then == "function")
          return R(
            _,
            O,
            Vo(B),
            Q
          );
        if (B.$$typeof === St)
          return R(
            _,
            O,
            zo(_, B),
            Q
          );
        Lo(_, B);
      }
      return null;
    }
    function j(_, O, B, Q, ht) {
      if (typeof Q == "string" && Q !== "" || typeof Q == "number" || typeof Q == "bigint")
        return _ = _.get(B) || null, b(O, _, "" + Q, ht);
      if (typeof Q == "object" && Q !== null) {
        switch (Q.$$typeof) {
          case at:
            return _ = _.get(
              Q.key === null ? B : Q.key
            ) || null, x(O, _, Q, ht);
          case lt:
            return _ = _.get(
              Q.key === null ? B : Q.key
            ) || null, V(O, _, Q, ht);
          case L:
            return Q = la(Q), j(
              _,
              O,
              B,
              Q,
              ht
            );
        }
        if (ft(Q) || J(Q))
          return _ = _.get(B) || null, Y(O, _, Q, ht, null);
        if (typeof Q.then == "function")
          return j(
            _,
            O,
            B,
            Vo(Q),
            ht
          );
        if (Q.$$typeof === St)
          return j(
            _,
            O,
            B,
            zo(O, Q),
            ht
          );
        Lo(O, Q);
      }
      return null;
    }
    function ot(_, O, B, Q) {
      for (var ht = null, Vt = null, bt = O, Et = O = 0, ue = null; bt !== null && Et < B.length; Et++) {
        bt.index > Et ? (ue = bt, bt = null) : ue = bt.sibling;
        var Lt = R(
          _,
          bt,
          B[Et],
          Q
        );
        if (Lt === null) {
          bt === null && (bt = ue);
          break;
        }
        t && bt && Lt.alternate === null && e(_, bt), O = u(Lt, O, Et), Vt === null ? ht = Lt : Vt.sibling = Lt, Vt = Lt, bt = ue;
      }
      if (Et === B.length)
        return n(_, bt), Dt && Pn(_, Et), ht;
      if (bt === null) {
        for (; Et < B.length; Et++)
          bt = Z(_, B[Et], Q), bt !== null && (O = u(
            bt,
            O,
            Et
          ), Vt === null ? ht = bt : Vt.sibling = bt, Vt = bt);
        return Dt && Pn(_, Et), ht;
      }
      for (bt = l(bt); Et < B.length; Et++)
        ue = j(
          bt,
          _,
          Et,
          B[Et],
          Q
        ), ue !== null && (t && (Lt = ue.alternate, Lt !== null && bt.delete(Lt.key === null ? Et : Lt.key)), O = u(
          ue,
          O,
          Et
        ), Vt === null ? ht = ue : Vt.sibling = ue, Vt = ue);
      return t && bt.forEach(function(Li) {
        return e(_, Li);
      }), Dt && Pn(_, Et), ht;
    }
    function yt(_, O, B, Q) {
      if (B == null) throw Error(o(151));
      for (var ht = null, Vt = null, bt = O, Et = O = 0, ue = null, Lt = B.next(); bt !== null && !Lt.done; Et++, Lt = B.next()) {
        bt.index > Et ? (ue = bt, bt = null) : ue = bt.sibling;
        var Li = R(_, bt, Lt.value, Q);
        if (Li === null) {
          bt === null && (bt = ue);
          break;
        }
        t && bt && Li.alternate === null && e(_, bt), O = u(Li, O, Et), Vt === null ? ht = Li : Vt.sibling = Li, Vt = Li, bt = ue;
      }
      if (Lt.done)
        return n(_, bt), Dt && Pn(_, Et), ht;
      if (bt === null) {
        for (; !Lt.done; Et++, Lt = B.next())
          Lt = Z(_, Lt.value, Q), Lt !== null && (O = u(Lt, O, Et), Vt === null ? ht = Lt : Vt.sibling = Lt, Vt = Lt);
        return Dt && Pn(_, Et), ht;
      }
      for (bt = l(bt); !Lt.done; Et++, Lt = B.next())
        Lt = j(bt, _, Et, Lt.value, Q), Lt !== null && (t && (ue = Lt.alternate, ue !== null && bt.delete(
          ue.key === null ? Et : ue.key
        )), O = u(Lt, O, Et), Vt === null ? ht = Lt : Vt.sibling = Lt, Vt = Lt);
      return t && bt.forEach(function(OA) {
        return e(_, OA);
      }), Dt && Pn(_, Et), ht;
    }
    function Ct(_, O, B, Q) {
      if (typeof B == "object" && B !== null && B.type === st && B.key === null && B.props.ref === void 0 && (B = B.props.children), typeof B == "object" && B !== null) {
        switch (B.$$typeof) {
          case at:
            t: {
              for (var ht = B.key; O !== null; ) {
                if (O.key === ht) {
                  if (ht = B.type, ht === st) {
                    if (O.tag === 7) {
                      n(
                        _,
                        O.sibling
                      ), Q = r(
                        O,
                        B.props.children
                      ), gi(Q, B), Q.return = _, _ = Q;
                      break t;
                    }
                  } else if (O.elementType === ht || typeof ht == "object" && ht !== null && ht.$$typeof === L && la(ht) === O.type) {
                    n(
                      _,
                      O.sibling
                    ), Q = r(O, B.props), gi(Q, B), Q.return = _, _ = Q;
                    break t;
                  }
                  n(_, O);
                  break;
                } else e(_, O);
                O = O.sibling;
              }
              B.type === st ? (Q = Wi(
                B.props.children,
                _.mode,
                Q,
                B.key
              ), gi(Q, B), Q.return = _, _ = Q) : (Q = xo(
                B.type,
                B.key,
                B.props,
                null,
                _.mode,
                Q
              ), gi(Q, B), Q.return = _, _ = Q);
            }
            return m(_);
          case lt:
            t: {
              for (ht = B.key; O !== null; ) {
                if (O.key === ht)
                  if (O.tag === 4 && O.stateNode.containerInfo === B.containerInfo && O.stateNode.implementation === B.implementation) {
                    n(
                      _,
                      O.sibling
                    ), Q = r(O, B.children || []), Q.return = _, _ = Q;
                    break t;
                  } else {
                    n(_, O);
                    break;
                  }
                else e(_, O);
                O = O.sibling;
              }
              Q = tc(B, _.mode, Q), Q.return = _, _ = Q;
            }
            return m(_);
          case L:
            return B = la(B), Ct(
              _,
              O,
              B,
              Q
            );
        }
        if (ft(B))
          return ot(
            _,
            O,
            B,
            Q
          );
        if (J(B)) {
          if (ht = J(B), typeof ht != "function") throw Error(o(150));
          return B = ht.call(B), yt(
            _,
            O,
            B,
            Q
          );
        }
        if (typeof B.then == "function")
          return Ct(
            _,
            O,
            Vo(B),
            Q
          );
        if (B.$$typeof === St)
          return Ct(
            _,
            O,
            zo(_, B),
            Q
          );
        Lo(_, B);
      }
      return typeof B == "string" && B !== "" || typeof B == "number" || typeof B == "bigint" ? (B = "" + B, O !== null && O.tag === 6 ? (n(_, O.sibling), Q = r(O, B), Q.return = _, _ = Q) : (n(_, O), Q = $u(B, _.mode, Q), Q.return = _, _ = Q), m(_)) : n(_, O);
    }
    return function(_, O, B, Q) {
      try {
        ns = 0;
        var ht = Ct(
          _,
          O,
          B,
          Q
        );
        return ka = null, ht;
      } catch (bt) {
        if (bt === Ka || bt === No) throw bt;
        var Vt = Ue(29, bt, null, _.mode);
        return Vt.lanes = Q, Vt.return = _, Vt;
      } finally {
      }
    };
  }
  var oa = vp(!0), bp = vp(!1), yi = !1;
  function cc(t) {
    t.updateQueue = {
      baseState: t.memoizedState,
      firstBaseUpdate: null,
      lastBaseUpdate: null,
      shared: { pending: null, lanes: 0, hiddenCallbacks: null },
      callbacks: null
    };
  }
  function fc(t, e) {
    t = t.updateQueue, e.updateQueue === t && (e.updateQueue = {
      baseState: t.baseState,
      firstBaseUpdate: t.firstBaseUpdate,
      lastBaseUpdate: t.lastBaseUpdate,
      shared: t.shared,
      callbacks: null
    });
  }
  function vi(t) {
    return { lane: t, tag: 0, payload: null, callback: null, next: null };
  }
  function bi(t, e, n) {
    var l = t.updateQueue;
    if (l === null) return null;
    if (l = l.shared, (jt & 2) !== 0) {
      var r = l.pending;
      return r === null ? e.next = e : (e.next = r.next, r.next = e), l.pending = e, e = Ao(t), np(t, null, n), e;
    }
    return Eo(t, l, e, n), Ao(t);
  }
  function is(t, e, n) {
    if (e = e.updateQueue, e !== null && (e = e.shared, (n & 4194048) !== 0)) {
      var l = e.lanes;
      l &= t.pendingLanes, n |= l, e.lanes = n, sm(t, n);
    }
  }
  function dc(t, e) {
    var n = t.updateQueue, l = t.alternate;
    if (l !== null && (l = l.updateQueue, n === l)) {
      var r = null, u = null;
      if (n = n.firstBaseUpdate, n !== null) {
        do {
          var m = {
            lane: n.lane,
            tag: n.tag,
            payload: n.payload,
            callback: null,
            next: null
          };
          u === null ? r = u = m : u = u.next = m, n = n.next;
        } while (n !== null);
        u === null ? r = u = e : u = u.next = e;
      } else r = u = e;
      n = {
        baseState: l.baseState,
        firstBaseUpdate: r,
        lastBaseUpdate: u,
        shared: l.shared,
        callbacks: l.callbacks
      }, t.updateQueue = n;
      return;
    }
    t = n.lastBaseUpdate, t === null ? n.firstBaseUpdate = e : t.next = e, n.lastBaseUpdate = e;
  }
  var hc = !1;
  function as() {
    if (hc) {
      var t = Za;
      if (t !== null) throw t;
    }
  }
  function ls(t, e, n, l) {
    hc = !1;
    var r = t.updateQueue;
    yi = !1;
    var u = r.firstBaseUpdate, m = r.lastBaseUpdate, b = r.shared.pending;
    if (b !== null) {
      r.shared.pending = null;
      var x = b, V = x.next;
      x.next = null, m === null ? u = V : m.next = V, m = x;
      var Y = t.alternate;
      Y !== null && (Y = Y.updateQueue, b = Y.lastBaseUpdate, b !== m && (b === null ? Y.firstBaseUpdate = V : b.next = V, Y.lastBaseUpdate = x));
    }
    if (u !== null) {
      var Z = r.baseState;
      m = 0, Y = V = x = null, b = u;
      do {
        var R = b.lane & -536870913, j = R !== b.lane;
        if (j ? (_t & R) === R : (l & R) === R) {
          R !== 0 && R === ia && (hc = !0), Y !== null && (Y = Y.next = {
            lane: 0,
            tag: b.tag,
            payload: b.payload,
            callback: null,
            next: null
          });
          t: {
            var ot = t, yt = b;
            R = e;
            var Ct = n;
            switch (yt.tag) {
              case 1:
                if (ot = yt.payload, typeof ot == "function") {
                  Z = ot.call(Ct, Z, R);
                  break t;
                }
                Z = ot;
                break t;
              case 3:
                ot.flags = ot.flags & -65537 | 128;
              case 0:
                if (ot = yt.payload, R = typeof ot == "function" ? ot.call(Ct, Z, R) : ot, R == null) break t;
                Z = z({}, Z, R);
                break t;
              case 2:
                yi = !0;
            }
          }
          R = b.callback, R !== null && (t.flags |= 64, j && (t.flags |= 8192), j = r.callbacks, j === null ? r.callbacks = [R] : j.push(R));
        } else
          j = {
            lane: R,
            tag: b.tag,
            payload: b.payload,
            callback: b.callback,
            next: null
          }, Y === null ? (V = Y = j, x = Z) : Y = Y.next = j, m |= R;
        if (b = b.next, b === null) {
          if (b = r.shared.pending, b === null)
            break;
          j = b, b = j.next, j.next = null, r.lastBaseUpdate = j, r.shared.pending = null;
        }
      } while (!0);
      Y === null && (x = Z), r.baseState = x, r.firstBaseUpdate = V, r.lastBaseUpdate = Y, u === null && (r.shared.lanes = 0), wi |= m, t.lanes = m, t.memoizedState = Z;
    }
  }
  function Sp(t, e) {
    if (typeof t != "function")
      throw Error(o(191, t));
    t.call(e);
  }
  function Tp(t, e) {
    var n = t.callbacks;
    if (n !== null)
      for (t.callbacks = null, t = 0; t < n.length; t++)
        Sp(n[t], e);
  }
  var Si = Ht(null), Uo = Ht(0);
  function Ep(t, e) {
    t = ei, Mt(Uo, t), Mt(Si, e), ei = t | e.baseLanes;
  }
  function mc() {
    Mt(Uo, ei), Mt(Si, Si.current);
  }
  function pc() {
    ei = Uo.current, Ut(Si), Ut(Uo);
  }
  var Te = Ht(null), Ce = null;
  function Ti(t) {
    var e = t.alternate;
    Mt(Ee, Ee.current & 1), Mt(Te, t), Ce === null && (e === null || Si.current !== null || e.memoizedState !== null) && (Ce = t);
  }
  function gc(t) {
    Mt(Ee, Ee.current), Mt(Te, t), Ce === null && (Ce = t);
  }
  function Ap(t) {
    t.tag === 22 ? (Mt(Ee, Ee.current), Mt(Te, t), Ce === null && (Ce = t)) : Ei();
  }
  function Ei() {
    Mt(Ee, Ee.current), Mt(Te, Te.current);
  }
  function ke(t) {
    Ut(Te), Ce === t && (Ce = null), Ut(Ee);
  }
  var Ee = Ht(0);
  function ss(t, e) {
    Mt(Te, Te.current), Mt(Ee, e);
  }
  function yc(t) {
    Ut(Ee), Ut(Te), Ce === t && (Ce = null);
  }
  function Bo(t) {
    for (var e = t; e !== null; ) {
      if (e.tag === 13) {
        var n = e.memoizedState;
        if (n !== null && (n = n.dehydrated, n === null || Gf(n) || Yf(n)))
          return e;
      } else if (e.tag === 19 && e.memoizedProps.revealOrder !== "independent") {
        if ((e.flags & 128) !== 0) return e;
      } else if (e.child !== null) {
        e.child.return = e, e = e.child;
        continue;
      }
      if (e === t) break;
      for (; e.sibling === null; ) {
        if (e.return === null || e.return === t) return null;
        e = e.return;
      }
      e.sibling.return = e.return, e = e.sibling;
    }
    return null;
  }
  var In = 0, wt = null, kt = null, oe = null, Ho = !1, Pa = !1, ra = !1, jo = 0, os = 0, Ja = null, FT = 0;
  function ee() {
    throw Error(o(321));
  }
  function vc(t, e) {
    if (e === null) return !1;
    for (var n = 0; n < e.length && n < t.length; n++)
      if (!Ke(t[n], e[n])) return !1;
    return !0;
  }
  function bc(t, e, n, l, r, u) {
    return In = u, wt = e, e.memoizedState = null, e.updateQueue = null, e.lanes = 0, P.H = t === null || t.memoizedState === null ? sg : og, ra = !1, u = n(l, r), ra = !1, Pa && (u = Mp(
      e,
      n,
      l,
      r
    )), xp(t), u;
  }
  function xp(t) {
    P.H = Ko;
    var e = kt !== null && kt.next !== null;
    if (In = 0, oe = kt = wt = null, Ho = !1, os = 0, Ja = null, e) throw Error(o(300));
    t === null || re || (t = t.dependencies, t !== null && Oo(t) && (re = !0));
  }
  function Mp(t, e, n, l) {
    wt = t;
    var r = 0;
    do {
      if (Pa && (Ja = null), os = 0, Pa = !1, 25 <= r) throw Error(o(301));
      if (r += 1, oe = kt = null, t.updateQueue != null) {
        var u = t.updateQueue;
        u.lastEffect = null, u.events = null, u.stores = null, u.memoCache != null && (u.memoCache.index = 0);
      }
      P.H = aE, u = e(n, l);
    } while (Pa);
    return u;
  }
  function IT() {
    var t = P.H, e = t.useState()[0];
    return e = typeof e.then == "function" ? rs(e) : e, t = t.useState()[0], (kt !== null ? kt.memoizedState : null) !== t && (wt.flags |= 1024), e;
  }
  function Sc() {
    var t = jo !== 0;
    return jo = 0, t;
  }
  function Tc(t, e, n) {
    e.updateQueue = t.updateQueue, e.flags &= -2053, t.lanes &= ~n;
  }
  function Ec(t) {
    if (Ho) {
      for (t = t.memoizedState; t !== null; ) {
        var e = t.queue;
        e !== null && (e.pending = null), t = t.next;
      }
      Ho = !1;
    }
    In = 0, oe = kt = wt = null, Pa = !1, os = jo = 0, Ja = null;
  }
  function Re() {
    var t = {
      memoizedState: null,
      baseState: null,
      baseQueue: null,
      queue: null,
      next: null
    };
    return oe === null ? wt.memoizedState = oe = t : oe = oe.next = t, oe;
  }
  function ae() {
    if (kt === null) {
      var t = wt.alternate;
      t = t !== null ? t.memoizedState : null;
    } else t = kt.next;
    var e = oe === null ? wt.memoizedState : oe.next;
    if (e !== null)
      oe = e, kt = t;
    else {
      if (t === null)
        throw wt.alternate === null ? Error(o(467)) : Error(o(310));
      kt = t, t = {
        memoizedState: kt.memoizedState,
        baseState: kt.baseState,
        baseQueue: kt.baseQueue,
        queue: kt.queue,
        next: null
      }, oe === null ? wt.memoizedState = oe = t : oe = oe.next = t;
    }
    return oe;
  }
  function Go() {
    return { lastEffect: null, events: null, stores: null, memoCache: null };
  }
  function rs(t) {
    var e = os;
    return os += 1, Ja === null && (Ja = []), t = pp(Ja, t, e), e = wt, (oe === null ? e.memoizedState : oe.next) === null && (e = e.alternate, P.H = e === null || e.memoizedState === null ? sg : og), t;
  }
  function Yo(t) {
    if (t !== null && typeof t == "object") {
      if (typeof t.then == "function") return rs(t);
      if (t.$$typeof === U) return;
      if (t.$$typeof === St) return Se(t);
    }
    throw Error(o(438, String(t)));
  }
  function Ac(t) {
    var e = null, n = wt.updateQueue;
    if (n !== null && (e = n.memoCache), e == null) {
      var l = wt.alternate;
      l !== null && (l = l.updateQueue, l !== null && (l = l.memoCache, l != null && (e = {
        data: l.data.map(function(r) {
          return r.slice();
        }),
        index: 0
      })));
    }
    if (e == null && (e = { data: [], index: 0 }), n === null && (n = Go(), wt.updateQueue = n), n.memoCache = e, n = e.data[e.index], n === void 0)
      for (n = e.data[e.index] = Array(t), l = 0; l < t; l++)
        n[l] = tt;
    return e.index++, n;
  }
  function Wn(t, e) {
    return typeof e == "function" ? e(t) : e;
  }
  function qo(t) {
    var e = ae();
    return xc(e, kt, t);
  }
  function xc(t, e, n) {
    var l = t.queue;
    if (l === null) throw Error(o(311));
    l.lastRenderedReducer = n;
    var r = t.baseQueue, u = l.pending;
    if (u !== null) {
      if (r !== null) {
        var m = r.next;
        r.next = u.next, u.next = m;
      }
      e.baseQueue = r = u, l.pending = null;
    }
    if (u = t.baseState, r === null) t.memoizedState = u;
    else {
      e = r.next;
      var b = m = null, x = null, V = e, Y = !1;
      do {
        var Z = V.lane & -536870913;
        if (Z !== V.lane ? (_t & Z) === Z : (In & Z) === Z) {
          var R = V.revertLane;
          if (R === 0)
            x !== null && (x = x.next = {
              lane: 0,
              revertLane: 0,
              gesture: null,
              action: V.action,
              hasEagerState: V.hasEagerState,
              eagerState: V.eagerState,
              next: null
            }), Z === ia && (Y = !0);
          else if ((In & R) === R) {
            V = V.next, R === ia && (Y = !0);
            continue;
          } else
            Z = {
              lane: 0,
              revertLane: V.revertLane,
              gesture: null,
              action: V.action,
              hasEagerState: V.hasEagerState,
              eagerState: V.eagerState,
              next: null
            }, x === null ? (b = x = Z, m = u) : x = x.next = Z, wt.lanes |= R, wi |= R;
          Z = V.action, ra && n(u, Z), u = V.hasEagerState ? V.eagerState : n(u, Z);
        } else
          R = {
            lane: Z,
            revertLane: V.revertLane,
            gesture: V.gesture,
            action: V.action,
            hasEagerState: V.hasEagerState,
            eagerState: V.eagerState,
            next: null
          }, x === null ? (b = x = R, m = u) : x = x.next = R, wt.lanes |= Z, wi |= Z;
        V = V.next;
      } while (V !== null && V !== e);
      if (x === null ? m = u : x.next = b, !Ke(u, t.memoizedState) && (re = !0, Y && (n = Za, n !== null)))
        throw n;
      t.memoizedState = u, t.baseState = m, t.baseQueue = x, l.lastRenderedState = u;
    }
    return r === null && (l.lanes = 0), [t.memoizedState, l.dispatch];
  }
  function Mc(t) {
    var e = ae(), n = e.queue;
    if (n === null) throw Error(o(311));
    n.lastRenderedReducer = t;
    var l = n.dispatch, r = n.pending, u = e.memoizedState;
    if (r !== null) {
      n.pending = null;
      var m = r = r.next;
      do
        u = t(u, m.action), m = m.next;
      while (m !== r);
      Ke(u, e.memoizedState) || (re = !0), e.memoizedState = u, e.baseQueue === null && (e.baseState = u), n.lastRenderedState = u;
    }
    return [u, l];
  }
  function wp(t, e, n) {
    var l = wt, r = ae(), u = Dt;
    if (u) {
      if (n === void 0) throw Error(o(407));
      n = n();
    } else n = e();
    var m = !Ke(
      (kt || r).memoizedState,
      n
    );
    if (m && (r.memoizedState = n, re = !0), r = r.queue, Dc(Op.bind(null, l, r, t), [
      t
    ]), t = r.getSnapshot !== e || m || oe !== null && (oe.memoizedState.tag & 1) !== 0, Fa(
      t ? 9 : 8,
      { destroy: void 0 },
      Dp.bind(null, l, r, n, e),
      null
    ), t) {
      if (l.flags |= 2048, Pt === null) throw Error(o(349));
      u || (In & 127) !== 0 || Cp(l, e, n);
    }
    return n;
  }
  function Cp(t, e, n) {
    t.flags |= 16384, t = { getSnapshot: e, value: n }, e = wt.updateQueue, e === null ? (e = Go(), wt.updateQueue = e, e.stores = [t]) : (n = e.stores, n === null ? e.stores = [t] : n.push(t));
  }
  function Dp(t, e, n, l) {
    e.value = n, e.getSnapshot = l, zp(e) && Rp(t);
  }
  function Op(t, e, n) {
    return n(function() {
      zp(e) && Rp(t);
    });
  }
  function zp(t) {
    var e = t.getSnapshot;
    t = t.value;
    try {
      var n = e();
      return !Ke(t, n);
    } catch {
      return !0;
    }
  }
  function Rp(t) {
    var e = Ii(t, 2);
    e !== null && Ge(e, t, 2);
  }
  function wc(t) {
    var e = Re();
    if (typeof t == "function") {
      var n = t;
      if (t = n(), ra) {
        ui(!0);
        try {
          n();
        } finally {
          ui(!1);
        }
      }
    }
    return e.memoizedState = e.baseState = t, e.queue = {
      pending: null,
      lanes: 0,
      dispatch: null,
      lastRenderedReducer: Wn,
      lastRenderedState: t
    }, e;
  }
  function Np(t, e, n, l) {
    return t.baseState = n, xc(
      t,
      kt,
      typeof l == "function" ? l : Wn
    );
  }
  function WT(t, e, n, l, r) {
    if (Zo(t)) throw Error(o(485));
    if (t = e.action, t !== null) {
      var u = {
        payload: r,
        action: t,
        next: null,
        isTransition: !0,
        status: "pending",
        value: null,
        reason: null,
        listeners: [],
        then: function(m) {
          u.listeners.push(m);
        }
      };
      P.T !== null ? n(!0) : u.isTransition = !1, l(u), n = e.pending, n === null ? (u.next = e.pending = u, _p(e, u)) : (u.next = n.next, e.pending = n.next = u);
    }
  }
  function _p(t, e) {
    var n = e.action, l = e.payload, r = t.state;
    if (e.isTransition) {
      var u = P.T, m = {};
      m.types = u !== null ? u.types : null, P.T = m;
      try {
        var b = n(r, l), x = P.S;
        x !== null && x(m, b), Vp(t, e, b);
      } catch (V) {
        Cc(t, e, V);
      } finally {
        u !== null && m.types !== null && (u.types = m.types), P.T = u;
      }
    } else
      try {
        u = n(r, l), Vp(t, e, u);
      } catch (V) {
        Cc(t, e, V);
      }
  }
  function Vp(t, e, n) {
    n !== null && typeof n == "object" && typeof n.then == "function" ? n.then(
      function(l) {
        Lp(t, e, l);
      },
      function(l) {
        return Cc(t, e, l);
      }
    ) : Lp(t, e, n);
  }
  function Lp(t, e, n) {
    e.status = "fulfilled", e.value = n, Up(e), t.state = n, e = t.pending, e !== null && (n = e.next, n === e ? t.pending = null : (n = n.next, e.next = n, _p(t, n)));
  }
  function Cc(t, e, n) {
    var l = t.pending;
    if (t.pending = null, l !== null) {
      l = l.next;
      do
        e.status = "rejected", e.reason = n, Up(e), e = e.next;
      while (e !== l);
    }
    t.action = null;
  }
  function Up(t) {
    t = t.listeners;
    for (var e = 0; e < t.length; e++) (0, t[e])();
  }
  function Bp(t, e) {
    return e;
  }
  function Hp(t, e) {
    if (Dt) {
      var n = Pt.formState;
      if (n !== null) {
        t: {
          var l = wt;
          if (Dt) {
            if (Ft) {
              e: {
                for (var r = Ft, u = rn; r.nodeType !== 8; ) {
                  if (!u) {
                    r = null;
                    break e;
                  }
                  if (r = cn(
                    r.nextSibling
                  ), r === null) {
                    r = null;
                    break e;
                  }
                }
                u = r.data, r = u === "F!" || u === "F" ? r : null;
              }
              if (r) {
                Ft = cn(
                  r.nextSibling
                ), l = r.data === "F!";
                break t;
              }
            }
            mi(l);
          }
          l = !1;
        }
        l && (e = n[0]);
      }
    }
    return n = Re(), n.memoizedState = n.baseState = e, l = {
      pending: null,
      lanes: 0,
      dispatch: null,
      lastRenderedReducer: Bp,
      lastRenderedState: e
    }, n.queue = l, n = ig.bind(
      null,
      wt,
      l
    ), l.dispatch = n, l = wc(!1), u = _c.bind(
      null,
      wt,
      !1,
      l.queue
    ), l = Re(), r = {
      state: e,
      dispatch: null,
      action: t,
      pending: null
    }, l.queue = r, n = WT.bind(
      null,
      wt,
      r,
      u,
      n
    ), r.dispatch = n, l.memoizedState = t, [e, n, !1];
  }
  function jp(t) {
    var e = ae();
    return Gp(e, kt, t);
  }
  function Gp(t, e, n) {
    if (e = xc(
      t,
      e,
      Bp
    )[0], t = qo(Wn)[0], typeof e == "object" && e !== null && typeof e.then == "function")
      try {
        var l = rs(e);
      } catch (m) {
        throw m === Ka ? No : m;
      }
    else l = e;
    e = ae();
    var r = e.queue, u = r.dispatch;
    return n !== e.memoizedState && (wt.flags |= 2048, Fa(
      9,
      { destroy: void 0 },
      $T.bind(null, r, n),
      null
    )), [l, u, t];
  }
  function $T(t, e) {
    t.action = e;
  }
  function Yp(t) {
    var e = ae(), n = kt;
    if (n !== null)
      return Gp(e, n, t);
    ae(), e = e.memoizedState, n = ae();
    var l = n.queue.dispatch;
    return n.memoizedState = t, [e, l, !1];
  }
  function Fa(t, e, n, l) {
    return t = { tag: t, create: n, deps: l, inst: e, next: null }, e = wt.updateQueue, e === null && (e = Go(), wt.updateQueue = e), n = e.lastEffect, n === null ? e.lastEffect = t.next = t : (l = n.next, n.next = t, t.next = l, e.lastEffect = t), t;
  }
  function qp() {
    return ae().memoizedState;
  }
  function Xo(t, e, n, l) {
    var r = Re();
    wt.flags |= t, r.memoizedState = Fa(
      1 | e,
      { destroy: void 0 },
      n,
      l === void 0 ? null : l
    );
  }
  function Qo(t, e, n, l) {
    var r = ae();
    l = l === void 0 ? null : l;
    var u = r.memoizedState.inst;
    kt !== null && l !== null && vc(l, kt.memoizedState.deps) ? r.memoizedState = Fa(e, u, n, l) : (wt.flags |= t, r.memoizedState = Fa(
      1 | e,
      u,
      n,
      l
    ));
  }
  function Xp(t, e) {
    Xo(8390656, 8, t, e);
  }
  function Dc(t, e) {
    Qo(2048, 8, t, e);
  }
  function tE(t) {
    wt.flags |= 4;
    var e = wt.updateQueue;
    if (e === null)
      e = Go(), wt.updateQueue = e, e.events = [t];
    else {
      var n = e.events;
      n === null ? e.events = [t] : n.push(t);
    }
  }
  function Qp(t) {
    var e = ae().memoizedState;
    return tE({ ref: e, nextImpl: t }), function() {
      if ((jt & 2) !== 0) throw Error(o(440));
      return e.impl.apply(void 0, arguments);
    };
  }
  function Zp(t, e) {
    return Qo(4, 2, t, e);
  }
  function Kp(t, e) {
    return Qo(4, 4, t, e);
  }
  function kp(t, e) {
    if (typeof e == "function") {
      t = t();
      var n = e(t);
      return function() {
        typeof n == "function" ? n() : e(null);
      };
    }
    if (e != null)
      return t = t(), e.current = t, function() {
        e.current = null;
      };
  }
  function Pp(t, e, n) {
    n = n != null ? n.concat([t]) : null, Qo(4, 4, kp.bind(null, e, t), n);
  }
  function Oc() {
  }
  function Jp(t, e) {
    var n = ae();
    e = e === void 0 ? null : e;
    var l = n.memoizedState;
    return e !== null && vc(e, l[1]) ? l[0] : (n.memoizedState = [t, e], t);
  }
  function Fp(t, e) {
    var n = ae();
    e = e === void 0 ? null : e;
    var l = n.memoizedState;
    if (e !== null && vc(e, l[1]))
      return l[0];
    if (l = t(), ra) {
      ui(!0);
      try {
        t();
      } finally {
        ui(!1);
      }
    }
    return n.memoizedState = [l, e], l;
  }
  function zc(t, e, n) {
    return n === void 0 || (In & 1073741824) !== 0 && (_t & 261930) === 0 ? t.memoizedState = e : (t.memoizedState = n, t = sy(), wt.lanes |= t, wi |= t, n);
  }
  function Ip(t, e, n, l) {
    return Ke(n, e) ? n : Si.current !== null ? (t = zc(t, n, l), Ke(t, e) || (re = !0), t) : (In & 106) === 0 || (In & 1073741824) !== 0 && (_t & 261930) === 0 ? (re = !0, t.memoizedState = n) : (t = sy(), wt.lanes |= t, wi |= t, e);
  }
  function Wp(t, e, n, l, r) {
    var u = G.p;
    G.p = u !== 0 && 8 > u ? u : 8;
    var m = P.T, b = {};
    b.types = m !== null ? m.types : null, P.T = b, _c(t, !1, e, n);
    try {
      var x = r(), V = P.S;
      if (V !== null && V(b, x), x !== null && typeof x == "object" && typeof x.then == "function") {
        var Y = JT(
          x,
          l
        );
        us(
          t,
          e,
          Y,
          Ie(t)
        );
      } else
        us(
          t,
          e,
          l,
          Ie(t)
        );
    } catch (Z) {
      us(
        t,
        e,
        { then: function() {
        }, status: "rejected", reason: Z },
        Ie()
      );
    } finally {
      G.p = u, m !== null && b.types !== null && (m.types = b.types), P.T = m;
    }
  }
  function eE() {
  }
  function Rc(t, e, n, l) {
    if (t.tag !== 5) throw Error(o(476));
    var r = $p(t).queue;
    Wp(
      t,
      r,
      e,
      ct,
      n === null ? eE : function() {
        return tg(t), n(l);
      }
    );
  }
  function $p(t) {
    var e = t.memoizedState;
    if (e !== null) return e;
    e = {
      memoizedState: ct,
      baseState: ct,
      baseQueue: null,
      queue: {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: Wn,
        lastRenderedState: ct
      },
      next: null
    };
    var n = {};
    return e.next = {
      memoizedState: n,
      baseState: n,
      baseQueue: null,
      queue: {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: Wn,
        lastRenderedState: n
      },
      next: null
    }, t.memoizedState = e, t = t.alternate, t !== null && (t.memoizedState = e), e;
  }
  function tg(t) {
    var e = $p(t);
    e.next === null && (e = t.alternate.memoizedState), us(
      t,
      e.next.queue,
      {},
      Ie()
    );
  }
  function Nc() {
    return Se(pl);
  }
  function eg() {
    return ae().memoizedState;
  }
  function ng() {
    return ae().memoizedState;
  }
  function nE(t) {
    for (var e = t.return; e !== null; ) {
      switch (e.tag) {
        case 24:
        case 3:
          var n = Ie();
          t = vi(n);
          var l = bi(e, t, n);
          l !== null && (Ge(l, e, n), is(l, e, n)), e = { cache: sc() }, t.payload = e;
          return;
      }
      e = e.return;
    }
  }
  function iE(t, e, n) {
    var l = Ie();
    n = {
      lane: l,
      revertLane: 0,
      gesture: null,
      action: n,
      hasEagerState: !1,
      eagerState: null,
      next: null
    }, Zo(t) ? ag(e, n) : (n = Iu(t, e, n, l), n !== null && (Ge(n, t, l), lg(n, e, l)));
  }
  function ig(t, e, n) {
    var l = Ie();
    us(t, e, n, l);
  }
  function us(t, e, n, l) {
    var r = {
      lane: l,
      revertLane: 0,
      gesture: null,
      action: n,
      hasEagerState: !1,
      eagerState: null,
      next: null
    };
    if (Zo(t)) ag(e, r);
    else {
      var u = t.alternate;
      if (t.lanes === 0 && (u === null || u.lanes === 0) && (u = e.lastRenderedReducer, u !== null))
        try {
          var m = e.lastRenderedState, b = u(m, n);
          if (r.hasEagerState = !0, r.eagerState = b, Ke(b, m))
            return Eo(t, e, r, 0), Pt === null && To(), !1;
        } catch {
        } finally {
        }
      if (n = Iu(t, e, r, l), n !== null)
        return Ge(n, t, l), lg(n, e, l), !0;
    }
    return !1;
  }
  function _c(t, e, n, l) {
    if (l = {
      lane: 2,
      revertLane: xf(),
      gesture: null,
      action: l,
      hasEagerState: !1,
      eagerState: null,
      next: null
    }, Zo(t)) {
      if (e) throw Error(o(479));
    } else
      e = Iu(
        t,
        n,
        l,
        2
      ), e !== null && Ge(e, t, 2);
  }
  function Zo(t) {
    var e = t.alternate;
    return t === wt || e !== null && e === wt;
  }
  function ag(t, e) {
    Pa = Ho = !0;
    var n = t.pending;
    n === null ? e.next = e : (e.next = n.next, n.next = e), t.pending = e;
  }
  function lg(t, e, n) {
    if ((n & 4194048) !== 0) {
      var l = e.lanes;
      l &= t.pendingLanes, n |= l, e.lanes = n, sm(t, n);
    }
  }
  var Ko = {
    readContext: Se,
    use: Yo,
    useCallback: ee,
    useContext: ee,
    useEffect: ee,
    useImperativeHandle: ee,
    useLayoutEffect: ee,
    useInsertionEffect: ee,
    useMemo: ee,
    useReducer: ee,
    useRef: ee,
    useState: ee,
    useDebugValue: ee,
    useDeferredValue: ee,
    useTransition: ee,
    useSyncExternalStore: ee,
    useId: ee,
    useHostTransitionStatus: ee,
    useFormState: ee,
    useActionState: ee,
    useOptimistic: ee,
    useMemoCache: ee,
    useCacheRefresh: ee,
    useEffectEvent: ee
  }, sg = {
    readContext: Se,
    use: Yo,
    useCallback: function(t, e) {
      return Re().memoizedState = [
        t,
        e === void 0 ? null : e
      ], t;
    },
    useContext: Se,
    useEffect: Xp,
    useImperativeHandle: function(t, e, n) {
      n = n != null ? n.concat([t]) : null, Xo(
        4194308,
        4,
        kp.bind(null, e, t),
        n
      );
    },
    useLayoutEffect: function(t, e) {
      return Xo(4194308, 4, t, e);
    },
    useInsertionEffect: function(t, e) {
      Xo(4, 2, t, e);
    },
    useMemo: function(t, e) {
      var n = Re();
      e = e === void 0 ? null : e;
      var l = t();
      if (ra) {
        ui(!0);
        try {
          t();
        } finally {
          ui(!1);
        }
      }
      return n.memoizedState = [l, e], l;
    },
    useReducer: function(t, e, n) {
      var l = Re();
      if (n !== void 0) {
        var r = n(e);
        if (ra) {
          ui(!0);
          try {
            n(e);
          } finally {
            ui(!1);
          }
        }
      } else r = e;
      return l.memoizedState = l.baseState = r, t = {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: t,
        lastRenderedState: r
      }, l.queue = t, t = t.dispatch = iE.bind(
        null,
        wt,
        t
      ), [l.memoizedState, t];
    },
    useRef: function(t) {
      var e = Re();
      return t = { current: t }, e.memoizedState = t;
    },
    useState: function(t) {
      t = wc(t);
      var e = t.queue, n = ig.bind(null, wt, e);
      return e.dispatch = n, [t.memoizedState, n];
    },
    useDebugValue: Oc,
    useDeferredValue: function(t, e) {
      var n = Re();
      return zc(n, t, e);
    },
    useTransition: function() {
      var t = wc(!1);
      return t = Wp.bind(
        null,
        wt,
        t.queue,
        !0,
        !1
      ), Re().memoizedState = t, [!1, t];
    },
    useSyncExternalStore: function(t, e, n) {
      var l = wt, r = Re();
      if (Dt) {
        if (n === void 0)
          throw Error(o(407));
        n = n();
      } else {
        if (n = e(), Pt === null)
          throw Error(o(349));
        (_t & 127) !== 0 || Cp(l, e, n);
      }
      r.memoizedState = n;
      var u = { value: n, getSnapshot: e };
      return r.queue = u, Xp(Op.bind(null, l, u, t), [
        t
      ]), l.flags |= 2048, Fa(
        9,
        { destroy: void 0 },
        Dp.bind(
          null,
          l,
          u,
          n,
          e
        ),
        null
      ), n;
    },
    useId: function() {
      var t = Re(), e = Pt.identifierPrefix;
      if (Dt) {
        var n = On, l = Dn;
        n = (l & ~(1 << 32 - Qe(l) - 1)).toString(32) + n, e = "_" + e + "R_" + n, n = jo++, 0 < n && (e += "H" + n.toString(32)), e += "_";
      } else
        n = FT++, e = "_" + e + "r_" + n.toString(32) + "_";
      return t.memoizedState = e;
    },
    useHostTransitionStatus: Nc,
    useFormState: Hp,
    useActionState: Hp,
    useOptimistic: function(t) {
      var e = Re();
      e.memoizedState = e.baseState = t;
      var n = {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: null,
        lastRenderedState: null
      };
      return e.queue = n, e = _c.bind(
        null,
        wt,
        !0,
        n
      ), n.dispatch = e, [t, e];
    },
    useMemoCache: Ac,
    useCacheRefresh: function() {
      return Re().memoizedState = nE.bind(
        null,
        wt
      );
    },
    useEffectEvent: function(t) {
      var e = Re(), n = { impl: t };
      return e.memoizedState = n, function() {
        if ((jt & 2) !== 0)
          throw Error(o(440));
        return n.impl.apply(void 0, arguments);
      };
    }
  }, og = {
    readContext: Se,
    use: Yo,
    useCallback: Jp,
    useContext: Se,
    useEffect: Dc,
    useImperativeHandle: Pp,
    useInsertionEffect: Zp,
    useLayoutEffect: Kp,
    useMemo: Fp,
    useReducer: qo,
    useRef: qp,
    useState: function() {
      return qo(Wn);
    },
    useDebugValue: Oc,
    useDeferredValue: function(t, e) {
      var n = ae();
      return Ip(
        n,
        kt.memoizedState,
        t,
        e
      );
    },
    useTransition: function() {
      var t = qo(Wn)[0], e = ae().memoizedState;
      return [
        typeof t == "boolean" ? t : rs(t),
        e
      ];
    },
    useSyncExternalStore: wp,
    useId: eg,
    useHostTransitionStatus: Nc,
    useFormState: jp,
    useActionState: jp,
    useOptimistic: function(t, e) {
      var n = ae();
      return Np(n, kt, t, e);
    },
    useMemoCache: Ac,
    useCacheRefresh: ng,
    useEffectEvent: Qp
  }, aE = {
    readContext: Se,
    use: Yo,
    useCallback: Jp,
    useContext: Se,
    useEffect: Dc,
    useImperativeHandle: Pp,
    useInsertionEffect: Zp,
    useLayoutEffect: Kp,
    useMemo: Fp,
    useReducer: Mc,
    useRef: qp,
    useState: function() {
      return Mc(Wn);
    },
    useDebugValue: Oc,
    useDeferredValue: function(t, e) {
      var n = ae();
      return kt === null ? zc(n, t, e) : Ip(
        n,
        kt.memoizedState,
        t,
        e
      );
    },
    useTransition: function() {
      var t = Mc(Wn)[0], e = ae().memoizedState;
      return [
        typeof t == "boolean" ? t : rs(t),
        e
      ];
    },
    useSyncExternalStore: wp,
    useId: eg,
    useHostTransitionStatus: Nc,
    useFormState: Yp,
    useActionState: Yp,
    useOptimistic: function(t, e) {
      var n = ae();
      return kt !== null ? Np(n, kt, t, e) : (n.baseState = t, [t, n.queue.dispatch]);
    },
    useMemoCache: Ac,
    useCacheRefresh: ng,
    useEffectEvent: Qp
  };
  function Vc(t, e, n, l) {
    e = t.memoizedState, n = n(l, e), n = n == null ? e : z({}, e, n), t.memoizedState = n, t.lanes === 0 && (t.updateQueue.baseState = n);
  }
  var Lc = {
    enqueueSetState: function(t, e, n) {
      t = t._reactInternals;
      var l = Ie(), r = vi(l);
      r.payload = e, n != null && (r.callback = n), e = bi(t, r, l), e !== null && (Ge(e, t, l), is(e, t, l));
    },
    enqueueReplaceState: function(t, e, n) {
      t = t._reactInternals;
      var l = Ie(), r = vi(l);
      r.tag = 1, r.payload = e, n != null && (r.callback = n), e = bi(t, r, l), e !== null && (Ge(e, t, l), is(e, t, l));
    },
    enqueueForceUpdate: function(t, e) {
      t = t._reactInternals;
      var n = Ie(), l = vi(n);
      l.tag = 2, e != null && (l.callback = e), e = bi(t, l, n), e !== null && (Ge(e, t, n), is(e, t, n));
    }
  };
  function rg(t, e, n, l, r, u, m) {
    return t = t.stateNode, typeof t.shouldComponentUpdate == "function" ? t.shouldComponentUpdate(l, u, m) : e.prototype && e.prototype.isPureReactComponent ? !Jl(n, l) || !Jl(r, u) : !0;
  }
  function ug(t, e, n, l) {
    t = e.state, typeof e.componentWillReceiveProps == "function" && e.componentWillReceiveProps(n, l), typeof e.UNSAFE_componentWillReceiveProps == "function" && e.UNSAFE_componentWillReceiveProps(n, l), e.state !== t && Lc.enqueueReplaceState(e, e.state, null);
  }
  function ua(t, e) {
    var n = e;
    if ("ref" in e) {
      n = {};
      for (var l in e)
        l !== "ref" && (n[l] = e[l]);
    }
    if (t = t.defaultProps) {
      n === e && (n = z({}, n));
      for (var r in t)
        n[r] === void 0 && (n[r] = t[r]);
    }
    return n;
  }
  function cg(t) {
    So(t);
  }
  function fg(t) {
    console.error(t);
  }
  function dg(t) {
    So(t);
  }
  function ko(t, e) {
    try {
      var n = t.onUncaughtError;
      n(e.value, { componentStack: e.stack });
    } catch (l) {
      setTimeout(function() {
        throw l;
      });
    }
  }
  function hg(t, e, n) {
    try {
      var l = t.onCaughtError;
      l(n.value, {
        componentStack: n.stack,
        errorBoundary: e.tag === 1 ? e.stateNode : null
      });
    } catch (r) {
      setTimeout(function() {
        throw r;
      });
    }
  }
  function Uc(t, e, n) {
    return n = vi(n), n.tag = 3, n.payload = { element: null }, n.callback = function() {
      ko(t, e);
    }, n;
  }
  function mg(t) {
    return t = vi(t), t.tag = 3, t;
  }
  function pg(t, e, n, l) {
    var r = n.type.getDerivedStateFromError;
    if (typeof r == "function") {
      var u = l.value;
      t.payload = function() {
        return r(u);
      }, t.callback = function() {
        hg(e, n, l);
      };
    }
    var m = n.stateNode;
    m !== null && typeof m.componentDidCatch == "function" && (t.callback = function() {
      hg(e, n, l), typeof r != "function" && (Ci === null ? Ci = /* @__PURE__ */ new Set([this]) : Ci.add(this));
      var b = l.stack;
      this.componentDidCatch(l.value, {
        componentStack: b !== null ? b : ""
      });
    });
  }
  function lE(t, e, n, l, r) {
    if (n.flags |= 32768, l !== null && typeof l == "object" && typeof l.then == "function") {
      if (e = n.alternate, e !== null && ea(
        e,
        n,
        r,
        !0
      ), n = Te.current, n !== null) {
        switch (n.tag) {
          case 31:
          case 13:
          case 19:
            return Ce === null ? mr() : n.alternate === null && ne === 0 && (ne = 3), n.flags &= -257, n.flags |= 65536, n.lanes = r, l === _o ? n.flags |= 16384 : (e = n.updateQueue, e === null ? n.updateQueue = /* @__PURE__ */ new Set([l]) : e.add(l), Tf(t, l, r)), !1;
          case 22:
            return n.flags |= 65536, l === _o ? n.flags |= 16384 : (e = n.updateQueue, e === null ? (e = {
              transitions: null,
              markerInstances: null,
              retryQueue: /* @__PURE__ */ new Set([l])
            }, n.updateQueue = e) : (n = e.retryQueue, n === null ? e.retryQueue = /* @__PURE__ */ new Set([l]) : n.add(l)), Tf(t, l, r)), !1;
        }
        throw Error(o(435, n.tag));
      }
      return Tf(t, l, r), mr(), !1;
    }
    if (Dt)
      return e = Te.current, e !== null ? ((e.flags & 65536) === 0 && (e.flags |= 256), e.flags |= 65536, e.lanes = r, l !== nc && (t = Error(o(422), { cause: l }), Wl(ln(t, n)))) : (l !== nc && (e = Error(o(423), {
        cause: l
      }), Wl(
        ln(e, n)
      )), t = t.current.alternate, t.flags |= 65536, r &= -r, t.lanes |= r, l = ln(l, n), r = Uc(
        t.stateNode,
        l,
        r
      ), dc(t, r), ne !== 4 && (ne = 2)), !1;
    var u = Error(o(520), { cause: l });
    if (u = ln(u, n), ys === null ? ys = [u] : ys.push(u), ne !== 4 && (ne = 2), e === null) return !0;
    l = ln(l, n), n = e;
    do {
      switch (n.tag) {
        case 3:
          return n.flags |= 65536, t = r & -r, n.lanes |= t, t = Uc(n.stateNode, l, t), dc(n, t), !1;
        case 1:
          if (e = n.type, u = n.stateNode, (n.flags & 128) === 0 && (typeof e.getDerivedStateFromError == "function" || u !== null && typeof u.componentDidCatch == "function" && (Ci === null || !Ci.has(u))))
            return n.flags |= 65536, r &= -r, n.lanes |= r, r = mg(r), pg(
              r,
              t,
              n,
              l
            ), dc(n, r), !1;
          break;
        case 22:
          if (n.memoizedState !== null)
            return n.flags |= 65536, !1;
      }
      n = n.return;
    } while (n !== null);
    return !1;
  }
  var Bc = Error(o(461)), re = !1;
  function ce(t, e, n, l) {
    e.child = t === null ? bp(e, null, n, l) : oa(
      e,
      t.child,
      n,
      l
    );
  }
  function gg(t, e, n, l, r) {
    n = n.render;
    var u = e.ref;
    if ("ref" in l) {
      var m = {};
      for (var b in l)
        b !== "ref" && (m[b] = l[b]);
    } else m = l;
    return na(e), l = bc(
      t,
      e,
      n,
      m,
      u,
      r
    ), b = Sc(), t !== null && !re ? (Tc(t, e, r), $n(t, e, r)) : (Dt && b && wo(e), e.flags |= 1, ce(t, e, l, r), e.child);
  }
  function yg(t, e, n, l, r) {
    if (t === null) {
      var u = n.type;
      return typeof u == "function" && !Wu(u) && u.defaultProps === void 0 && n.compare === null ? (e.tag = 15, e.type = u, vg(
        t,
        e,
        u,
        l,
        r
      )) : (t = xo(
        n.type,
        null,
        l,
        e,
        e.mode,
        r
      ), t.ref = e.ref, t.return = e, e.child = t);
    }
    if (u = t.child, !Zc(t, r)) {
      var m = u.memoizedProps;
      if (n = n.compare, n = n !== null ? n : Jl, n(m, l) && t.ref === e.ref)
        return $n(t, e, r);
    }
    return e.flags |= 1, t = kn(u, l), t.ref = e.ref, t.return = e, e.child = t;
  }
  function vg(t, e, n, l, r) {
    if (t !== null) {
      var u = t.memoizedProps;
      if (Jl(u, l) && t.ref === e.ref)
        if (re = !1, e.pendingProps = l = u, Zc(t, r))
          (t.flags & 131072) !== 0 && (re = !0);
        else
          return e.lanes = t.lanes, $n(t, e, r);
    }
    return Hc(
      t,
      e,
      n,
      l,
      r
    );
  }
  function bg(t, e, n, l) {
    var r = l.children, u = t !== null ? t.memoizedState : null;
    if (t === null && e.stateNode === null && (e.stateNode = {
      _visibility: 1,
      _pendingMarkers: null,
      _retryCache: null,
      _transitions: null
    }), l.mode === "hidden") {
      if ((e.flags & 128) !== 0) {
        if (u = u !== null ? u.baseLanes | n : n, t !== null) {
          for (l = e.child = t.child, r = 0; l !== null; )
            r = r | l.lanes | l.childLanes, l = l.sibling;
          l = r & ~u;
        } else l = 0, e.child = null;
        return Sg(
          t,
          e,
          u,
          n,
          l
        );
      }
      if ((n & 536870912) !== 0)
        e.memoizedState = { baseLanes: 0, cachePool: null }, t !== null && Ro(
          e,
          u !== null ? u.cachePool : null
        ), u !== null ? Ep(e, u) : mc(), Ap(e);
      else
        return l = e.lanes = 536870912, Sg(
          t,
          e,
          u !== null ? u.baseLanes | n : n,
          n,
          l
        );
    } else
      u !== null ? (Ro(e, u.cachePool), Ep(e, u), Ei(), e.memoizedState = null) : (t !== null && Ro(e, null), mc(), Ei());
    return ce(t, e, r, n), e.child;
  }
  function cs(t, e) {
    return t !== null && t.tag === 22 || e.stateNode !== null || (e.stateNode = {
      _visibility: 1,
      _pendingMarkers: null,
      _retryCache: null,
      _transitions: null
    }), e.sibling;
  }
  function Sg(t, e, n, l, r) {
    var u = rc();
    return u = u === null ? null : { parent: se._currentValue, pool: u }, e.memoizedState = {
      baseLanes: n,
      cachePool: u
    }, t !== null && Ro(e, null), mc(), Ap(e), t !== null && ea(t, e, l, !0), e.childLanes = r, null;
  }
  function Po(t, e) {
    return e = Jo(
      { mode: e.mode, children: e.children },
      t.mode
    ), e.ref = t.ref, t.child = e, e.return = t, e;
  }
  function Tg(t, e, n) {
    return oa(e, t.child, null, n), t = Po(e, e.pendingProps), t.flags |= 2, ke(e), e.memoizedState = null, t;
  }
  function sE(t, e, n) {
    var l = e.pendingProps, r = (e.flags & 128) !== 0;
    if (e.flags &= -129, t === null) {
      if (Dt) {
        if (l.mode === "hidden")
          return t = Po(e, l), e.lanes = 536870912, t.memoizedState = { baseLanes: 0, cachePool: null }, cs(null, t);
        if (gc(e), (t = Ft) ? (t = ky(
          t,
          rn
        ), t = t !== null && t.data === "&" ? t : null, t !== null && (e.memoizedState = {
          dehydrated: t,
          treeContext: di !== null ? { id: Dn, overflow: On } : null,
          retryLane: 536870912,
          hydrationErrors: null
        }, n = ap(t), n.return = e, e.child = n, ge = e, Ft = null)) : t = null, t === null) throw mi(e);
        return e.lanes = 536870912, null;
      }
      return Po(e, l);
    }
    var u = t.memoizedState;
    if (u !== null) {
      var m = u.dehydrated;
      if (gc(e), r)
        if (e.flags & 256)
          e.flags &= -257, e = Tg(
            t,
            e,
            n
          );
        else if (e.memoizedState !== null)
          e.child = t.child, e.flags |= 128, e = null;
        else throw Error(o(558));
      else if (re || ea(t, e, n, !1), r = (n & t.childLanes) !== 0, re || r) {
        if (Si.current === null) {
          if (l = Pt, l !== null && (m = om(l, n), m !== 0 && m !== u.retryLane))
            throw u.retryLane = m, Ii(t, m), Ge(l, t, m), Bc;
          mr();
        }
        e = Tg(
          t,
          e,
          n
        );
      } else
        t = u.treeContext, Ft = cn(m.nextSibling), ge = e, Dt = !0, hi = null, rn = !1, t !== null && op(e, t), e = Po(e, l), e.flags |= 134221824;
      return e;
    }
    return t = kn(t.child, {
      mode: l.mode,
      children: l.children
    }), t.ref = e.ref, e.child = t, t.return = e, t;
  }
  function Ia(t, e) {
    var n = e.ref;
    if (n === null)
      t !== null && t.ref !== null && (e.flags |= 4194816);
    else {
      if (typeof n != "function" && typeof n != "object")
        throw Error(o(284));
      (t === null || t.ref !== n) && (e.flags |= 4194816);
    }
  }
  function Hc(t, e, n, l, r) {
    return na(e), n = bc(
      t,
      e,
      n,
      l,
      void 0,
      r
    ), l = Sc(), t !== null && !re ? (Tc(t, e, r), $n(t, e, r)) : (Dt && l && wo(e), e.flags |= 1, ce(t, e, n, r), e.child);
  }
  function Eg(t, e, n, l, r, u) {
    return na(e), e.updateQueue = null, n = Mp(
      e,
      l,
      n,
      r
    ), xp(t), l = Sc(), t !== null && !re ? (Tc(t, e, u), $n(t, e, u)) : (Dt && l && wo(e), e.flags |= 1, ce(t, e, n, u), e.child);
  }
  function Ag(t, e, n, l, r) {
    if (na(e), e.stateNode === null) {
      var u = Ya, m = n.contextType;
      typeof m == "object" && m !== null && (u = Se(m)), u = new n(l, u), e.memoizedState = u.state !== null && u.state !== void 0 ? u.state : null, u.updater = Lc, e.stateNode = u, u._reactInternals = e, u = e.stateNode, u.props = l, u.state = e.memoizedState, u.refs = {}, cc(e), m = n.contextType, u.context = typeof m == "object" && m !== null ? Se(m) : Ya, u.state = e.memoizedState, m = n.getDerivedStateFromProps, typeof m == "function" && (Vc(
        e,
        n,
        m,
        l
      ), u.state = e.memoizedState), typeof n.getDerivedStateFromProps == "function" || typeof u.getSnapshotBeforeUpdate == "function" || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (m = u.state, typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount(), m !== u.state && Lc.enqueueReplaceState(u, u.state, null), ls(e, l, u, r), as(), u.state = e.memoizedState), typeof u.componentDidMount == "function" && (e.flags |= 4194308), l = !0;
    } else if (t === null) {
      u = e.stateNode;
      var b = e.memoizedProps, x = ua(n, b);
      u.props = x;
      var V = u.context, Y = n.contextType;
      m = Ya, typeof Y == "object" && Y !== null && (m = Se(Y));
      var Z = n.getDerivedStateFromProps;
      Y = typeof Z == "function" || typeof u.getSnapshotBeforeUpdate == "function", b = e.pendingProps !== b, Y || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (b || V !== m) && ug(
        e,
        u,
        l,
        m
      ), yi = !1;
      var R = e.memoizedState;
      u.state = R, ls(e, l, u, r), as(), V = e.memoizedState, b || R !== V || yi ? (typeof Z == "function" && (Vc(
        e,
        n,
        Z,
        l
      ), V = e.memoizedState), (x = yi || rg(
        e,
        n,
        x,
        l,
        R,
        V,
        m
      )) ? (Y || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount()), typeof u.componentDidMount == "function" && (e.flags |= 4194308)) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), e.memoizedProps = l, e.memoizedState = V), u.props = l, u.state = V, u.context = m, l = x) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), l = !1);
    } else {
      u = e.stateNode, fc(t, e), m = e.memoizedProps, Y = ua(n, m), u.props = Y, Z = e.pendingProps, R = u.context, V = n.contextType, x = Ya, typeof V == "object" && V !== null && (x = Se(V)), b = n.getDerivedStateFromProps, (V = typeof b == "function" || typeof u.getSnapshotBeforeUpdate == "function") || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (m !== Z || R !== x) && ug(
        e,
        u,
        l,
        x
      ), yi = !1, R = e.memoizedState, u.state = R, ls(e, l, u, r), as();
      var j = e.memoizedState;
      m !== Z || R !== j || yi || t !== null && t.dependencies !== null && Oo(t.dependencies) ? (typeof b == "function" && (Vc(
        e,
        n,
        b,
        l
      ), j = e.memoizedState), (Y = yi || rg(
        e,
        n,
        Y,
        l,
        R,
        j,
        x
      ) || t !== null && t.dependencies !== null && Oo(t.dependencies)) ? (V || typeof u.UNSAFE_componentWillUpdate != "function" && typeof u.componentWillUpdate != "function" || (typeof u.componentWillUpdate == "function" && u.componentWillUpdate(l, j, x), typeof u.UNSAFE_componentWillUpdate == "function" && u.UNSAFE_componentWillUpdate(
        l,
        j,
        x
      )), typeof u.componentDidUpdate == "function" && (e.flags |= 4), typeof u.getSnapshotBeforeUpdate == "function" && (e.flags |= 1024)) : (typeof u.componentDidUpdate != "function" || m === t.memoizedProps && R === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || m === t.memoizedProps && R === t.memoizedState || (e.flags |= 1024), e.memoizedProps = l, e.memoizedState = j), u.props = l, u.state = j, u.context = x, l = Y) : (typeof u.componentDidUpdate != "function" || m === t.memoizedProps && R === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || m === t.memoizedProps && R === t.memoizedState || (e.flags |= 1024), l = !1);
    }
    return u = l, Ia(t, e), l = (e.flags & 128) !== 0, u || l ? (u = e.stateNode, n = l && typeof n.getDerivedStateFromError != "function" ? null : u.render(), e.flags |= 1, t !== null && l ? (e.child = oa(
      e,
      t.child,
      null,
      r
    ), e.child = oa(
      e,
      null,
      n,
      r
    )) : ce(t, e, n, r), e.memoizedState = u.state, t = e.child) : t = $n(
      t,
      e,
      r
    ), t;
  }
  function xg(t, e, n, l) {
    return $i(), e.flags |= 256, ce(t, e, n, l), e.child;
  }
  var jc = {
    dehydrated: null,
    treeContext: null,
    retryLane: 0,
    hydrationErrors: null
  };
  function Gc(t) {
    return { baseLanes: t, cachePool: hp() };
  }
  function Yc(t, e, n) {
    return t = t !== null ? t.childLanes & ~n : 0, e && (t |= Fe), t;
  }
  function Mg(t, e, n) {
    var l = e.pendingProps, r = !1, u = (e.flags & 128) !== 0, m;
    if ((m = u) || (m = t !== null && t.memoizedState === null ? !1 : (Ee.current & 2) !== 0), m && (r = !0, e.flags &= -129), m = (e.flags & 32) !== 0, e.flags &= -33, t === null) {
      if (Dt) {
        if (r ? Ti(e) : Ei(), (t = Ft) ? (t = ky(
          t,
          rn
        ), t = t !== null && t.data !== "&" ? t : null, t !== null && (e.memoizedState = {
          dehydrated: t,
          treeContext: di !== null ? { id: Dn, overflow: On } : null,
          retryLane: 536870912,
          hydrationErrors: null
        }, n = ap(t), n.return = e, e.child = n, ge = e, Ft = null)) : t = null, t === null) throw mi(e);
        return Yf(t) ? e.lanes = 32 : e.lanes = 536870912, null;
      }
      return u = l.children, l = l.fallback, r ? (Ei(), r = e.mode, u = Jo(
        { mode: "hidden", children: u },
        r
      ), l = Wi(
        l,
        r,
        n,
        null
      ), u.return = e, l.return = e, u.sibling = l, e.child = u, l = e.child, l.memoizedState = Gc(n), l.childLanes = Yc(
        t,
        m,
        n
      ), e.memoizedState = jc, cs(null, l)) : (Ti(e), qc(e, u));
    }
    var b = t.memoizedState;
    if (b !== null) {
      var x = b.dehydrated;
      if (x !== null)
        return oE(
          t,
          e,
          u,
          m,
          l,
          x,
          b,
          n
        );
    }
    return r ? (Ei(), r = l.fallback, u = e.mode, b = t.child, x = b.sibling, l = kn(b, {
      mode: "hidden",
      children: l.children
    }), l.subtreeFlags = b.subtreeFlags & 1206910976, x !== null ? r = kn(x, r) : (r = Wi(
      r,
      u,
      n,
      null
    ), r.flags |= 2), r.return = e, l.return = e, l.sibling = r, e.child = l, cs(null, l), l = e.child, r = t.child.memoizedState, r === null ? r = Gc(n) : (u = r.cachePool, u !== null ? (b = se._currentValue, u = u.parent !== b ? { parent: b, pool: b } : u) : u = hp(), r = {
      baseLanes: r.baseLanes | n,
      cachePool: u
    }), l.memoizedState = r, l.childLanes = Yc(
      t,
      m,
      n
    ), e.memoizedState = jc, cs(t.child, l)) : (Ti(e), n = t.child, t = n.sibling, n = kn(n, {
      mode: "visible",
      children: l.children
    }), n.return = e, n.sibling = null, t !== null && (m = e.deletions, m === null ? (e.deletions = [t], e.flags |= 16) : m.push(t)), e.child = n, e.memoizedState = null, n);
  }
  function qc(t, e) {
    return e = Jo(
      { mode: "visible", children: e },
      t.mode
    ), e.return = t, t.child = e;
  }
  function Jo(t, e) {
    return t = Ue(22, t, null, e), t.lanes = 0, t;
  }
  function Fo(t, e, n) {
    return oa(e, t.child, null, n), t = qc(
      e,
      e.pendingProps.children
    ), t.flags |= 2, e.memoizedState = null, t;
  }
  function oE(t, e, n, l, r, u, m, b) {
    if (n)
      return e.flags & 256 ? (Ti(e), e.flags &= -257, Fo(
        t,
        e,
        b
      )) : e.memoizedState !== null ? (Ei(), e.child = t.child, e.flags |= 128, null) : (Ei(), u = r.fallback, m = e.mode, r = Jo(
        { mode: "visible", children: r.children },
        m
      ), u = Wi(
        u,
        m,
        b,
        null
      ), u.flags |= 2, r.return = e, u.return = e, r.sibling = u, e.child = r, oa(e, t.child, null, b), r = e.child, r.memoizedState = Gc(b), r.childLanes = Yc(
        t,
        l,
        b
      ), e.memoizedState = jc, cs(null, r));
    if (Ti(e), Yf(u)) {
      if (l = u.nextSibling && u.nextSibling.dataset, l) var x = l.dgst;
      return l = x, l !== "" && (r = Error(o(419)), r.stack = "", r.digest = l, Wl({ value: r, source: null, stack: null })), Fo(
        t,
        e,
        b
      );
    }
    if (re || ea(t, e, b, !1), l = (b & t.childLanes) !== 0, re || l) {
      if (Si.current !== null)
        return Fo(
          t,
          e,
          b
        );
      if (l = Pt, l !== null && (r = om(
        l,
        b
      ), r !== 0 && r !== m.retryLane))
        throw m.retryLane = r, Ii(t, r), Ge(l, t, r), Bc;
      return Gf(u) || mr(), Fo(
        t,
        e,
        b
      );
    }
    return Gf(u) ? (e.flags |= 192, e.child = t.child, null) : (t = m.treeContext, Ft = cn(u.nextSibling), ge = e, Dt = !0, hi = null, rn = !1, t !== null && op(e, t), e = qc(
      e,
      r.children
    ), e.flags |= 134221824, e);
  }
  function wg(t, e, n) {
    t.lanes |= e;
    var l = t.alternate;
    l !== null && (l.lanes |= e), Do(t.return, e, n);
  }
  function Cg(t) {
    for (var e = null; t !== null; ) {
      var n = t.alternate;
      n !== null && Bo(n) === null && (e = t), t = t.sibling;
    }
    return e;
  }
  function Io(t, e, n, l, r, u) {
    var m = t.memoizedState;
    m === null ? t.memoizedState = {
      isBackwards: e,
      rendering: null,
      renderingStartTime: 0,
      last: l,
      tail: n,
      tailMode: r,
      treeForkCount: u
    } : (m.isBackwards = e, m.rendering = null, m.renderingStartTime = 0, m.last = l, m.tail = n, m.tailMode = r, m.treeForkCount = u);
  }
  function Xc(t) {
    var e = t.child;
    for (t.child = null; e !== null; ) {
      var n = e.sibling;
      e.sibling = t.child, t.child = e, e = n;
    }
  }
  function Qc(t, e, n) {
    var l = e.pendingProps, r = l.revealOrder, u = l.tail;
    l = l.children;
    var m = Ee.current;
    if (e.flags & 128)
      return ss(e, m), null;
    var b = (m & 2) !== 0;
    if (b ? (m = m & 1 | 2, e.flags |= 128) : m &= 1, ss(e, m), r === "backwards" && t !== null ? (Xc(t), ce(t, e, l, n), Xc(t)) : ce(t, e, l, n), l = Dt ? Il : 0, !b && t !== null && (t.flags & 128) !== 0)
      t: for (t = e.child; t !== null; ) {
        if (t.tag === 13)
          t.memoizedState !== null && wg(t, n, e);
        else if (t.tag === 19)
          wg(t, n, e);
        else if (t.child !== null) {
          t.child.return = t, t = t.child;
          continue;
        }
        if (t === e) break t;
        for (; t.sibling === null; ) {
          if (t.return === null || t.return === e)
            break t;
          t = t.return;
        }
        t.sibling.return = t.return, t = t.sibling;
      }
    switch (r) {
      case "backwards":
        n = Cg(e.child), n === null ? (r = e.child, e.child = null) : (r = n.sibling, n.sibling = null, Xc(e)), Io(
          e,
          !0,
          r,
          null,
          u,
          l
        );
        break;
      case "unstable_legacy-backwards":
        for (n = null, r = e.child, e.child = null; r !== null; ) {
          if (t = r.alternate, t !== null && Bo(t) === null) {
            e.child = r;
            break;
          }
          t = r.sibling, r.sibling = n, n = r, r = t;
        }
        Io(
          e,
          !0,
          n,
          null,
          u,
          l
        );
        break;
      case "together":
        Io(
          e,
          !1,
          null,
          null,
          void 0,
          l
        );
        break;
      case "independent":
        e.memoizedState = null;
        break;
      default:
        n = Cg(e.child), n === null ? (r = e.child, e.child = null) : (r = n.sibling, n.sibling = null), Io(
          e,
          !1,
          r,
          n,
          u,
          l
        );
    }
    return e.child;
  }
  function Dg(t, e, n) {
    var l = e.pendingProps;
    return pi(e, e.type, l.value), ce(t, e, l.children, n), e.child;
  }
  function $n(t, e, n) {
    if (t !== null && (e.dependencies = t.dependencies), wi |= e.lanes, (n & e.childLanes) === 0)
      if (t !== null) {
        if (ea(
          t,
          e,
          n,
          !1
        ), (n & e.childLanes) === 0)
          return null;
      } else return null;
    if (t !== null && e.child !== t.child)
      throw Error(o(153));
    if (e.child !== null) {
      for (t = e.child, n = kn(t, t.pendingProps), e.child = n, n.return = e; t.sibling !== null; )
        t = t.sibling, n = n.sibling = kn(t, t.pendingProps), n.return = e;
      n.sibling = null;
    }
    return e.child;
  }
  function Zc(t, e) {
    return (t.lanes & e) !== 0 ? !0 : (t = t.dependencies, !!(t !== null && Oo(t)));
  }
  function rE(t, e, n) {
    switch (e.tag) {
      case 3:
        ri(e, e.stateNode.containerInfo), pi(e, se, t.memoizedState.cache), $i();
        break;
      case 27:
      case 5:
        wa(e);
        break;
      case 4:
        ri(e, e.stateNode.containerInfo);
        break;
      case 10:
        pi(
          e,
          e.type,
          e.memoizedProps.value
        );
        break;
      case 31:
        if (e.memoizedState !== null)
          return e.flags |= 128, gc(e), null;
        break;
      case 13:
        var l = e.memoizedState;
        if (l !== null) {
          if (l.dehydrated !== null)
            return Ti(e), e.flags |= 128, null;
          l = ea(
            t,
            e,
            n,
            !1
          );
          var r = e.child.childLanes;
          return l || (n & r) !== 0 ? Mg(t, e, n) : (Ti(e), t = $n(
            t,
            e,
            n
          ), t !== null ? t.sibling : null);
        }
        Ti(e);
        break;
      case 19:
        if (e.flags & 128)
          return Qc(
            t,
            e,
            n
          );
        if (r = (t.flags & 128) !== 0, l = (n & e.childLanes) !== 0, l || (ea(
          t,
          e,
          n,
          !1
        ), l = (n & e.childLanes) !== 0), r) {
          if (l)
            return Qc(
              t,
              e,
              n
            );
          e.flags |= 128;
        }
        if (r = e.memoizedState, r !== null && (r.rendering = null, r.tail = null, r.lastEffect = null), ss(e, Ee.current), l) break;
        return null;
      case 22:
        return e.lanes = 0, bg(
          t,
          e,
          n,
          e.pendingProps
        );
      case 24:
        pi(e, se, t.memoizedState.cache);
    }
    return $n(t, e, n);
  }
  function Og(t, e, n) {
    if (t !== null)
      if (t.memoizedProps !== e.pendingProps)
        re = !0;
      else {
        if (!Zc(t, n) && (e.flags & 128) === 0)
          return re = !1, rE(
            t,
            e,
            n
          );
        re = (t.flags & 131072) !== 0;
      }
    else
      re = !1, Dt && (e.flags & 1048576) !== 0 && sp(e, Il, e.index);
    switch (e.lanes = 0, e.tag) {
      case 16:
        t: {
          var l = e.pendingProps;
          if (t = la(e.elementType), e.type = t, typeof t == "function")
            Wu(t) ? (l = ua(t, l), e.tag = 1, e = Ag(
              null,
              e,
              t,
              l,
              n
            )) : (e.tag = 0, e = Hc(
              null,
              e,
              t,
              l,
              n
            ));
          else {
            if (t != null) {
              var r = t.$$typeof;
              if (r === F) {
                e.tag = 11, e = gg(
                  null,
                  e,
                  t,
                  l,
                  n
                );
                break t;
              } else if (r === nt) {
                e.tag = 14, e = yg(
                  null,
                  e,
                  t,
                  l,
                  n
                );
                break t;
              } else if (r === St) {
                e.tag = 10, e.type = t, e = Dg(
                  null,
                  e,
                  n
                );
                break t;
              }
            }
            throw e = W(t) || t, Error(o(306, e, ""));
          }
        }
        return e;
      case 0:
        return Hc(
          t,
          e,
          e.type,
          e.pendingProps,
          n
        );
      case 1:
        return l = e.type, r = ua(
          l,
          e.pendingProps
        ), Ag(
          t,
          e,
          l,
          r,
          n
        );
      case 3:
        t: {
          if (ri(
            e,
            e.stateNode.containerInfo
          ), t === null) throw Error(o(387));
          l = e.pendingProps;
          var u = e.memoizedState;
          r = u.element, fc(t, e), ls(e, l, null, n);
          var m = e.memoizedState;
          if (l = m.cache, pi(e, se, l), l !== u.cache && lc(
            e,
            [se],
            n,
            !0
          ), as(), l = m.element, u.isDehydrated)
            if (u = {
              element: l,
              isDehydrated: !1,
              cache: m.cache
            }, e.updateQueue.baseState = u, e.memoizedState = u, e.flags & 256) {
              e = xg(
                t,
                e,
                l,
                n
              );
              break t;
            } else if (l !== r) {
              r = ln(
                Error(o(424)),
                e
              ), Wl(r), e = xg(
                t,
                e,
                l,
                n
              );
              break t;
            } else {
              switch (t = e.stateNode.containerInfo, t.nodeType) {
                case 9:
                  t = t.body;
                  break;
                default:
                  t = t.nodeName === "HTML" ? t.ownerDocument.body : t;
              }
              for (Ft = cn(t.firstChild), ge = e, Dt = !0, hi = null, rn = !0, n = bp(
                e,
                null,
                l,
                n
              ), e.child = n; n; )
                n.flags = n.flags & -3 | 134221824, n = n.sibling;
            }
          else {
            if ($i(), l === r) {
              e = $n(
                t,
                e,
                n
              );
              break t;
            }
            ce(t, e, l, n);
          }
          e = e.child;
        }
        return e;
      case 26:
        return Ia(t, e), t === null ? (n = t0(
          e.type,
          null,
          e.pendingProps,
          null
        )) ? e.memoizedState = n : Dt || (e.stateNode = _y(
          e.type,
          e.pendingProps,
          Ve.current,
          e
        )) : e.memoizedState = t0(
          e.type,
          t.memoizedProps,
          e.pendingProps,
          t.memoizedState
        ), null;
      case 27:
        return wa(e), t === null && Dt && (l = e.stateNode = Fy(
          e.type,
          e.pendingProps,
          Ve.current
        ), ge = e, rn = !0, r = Ft, zi(e.type) ? (qf = r, Ft = cn(l.firstChild)) : Ft = r), ce(
          t,
          e,
          e.pendingProps.children,
          n
        ), Ia(t, e), t === null && (e.flags |= 4194304), e.child;
      case 5:
        return t === null && Dt && ((r = l = Ft) && (l = nA(
          l,
          e.type,
          e.pendingProps,
          rn
        ), l !== null ? (e.stateNode = l, ge = e, Ft = cn(l.firstChild), rn = !1, r = !0) : r = !1), r || mi(e)), wa(e), r = e.type, u = e.pendingProps, m = t !== null ? t.memoizedProps : null, l = u.children, _f(r, u) ? l = null : m !== null && _f(r, m) && (e.flags |= 32), e.memoizedState !== null && (r = bc(
          t,
          e,
          IT,
          null,
          null,
          n
        ), pl._currentValue = r), Ia(t, e), ce(t, e, l, n), e.child;
      case 6:
        return t === null && Dt && ((t = n = Ft) && (n = iA(
          n,
          e.pendingProps,
          rn
        ), n !== null ? (e.stateNode = n, ge = e, Ft = null, t = !0) : t = !1), t || mi(e)), null;
      case 13:
        return Mg(t, e, n);
      case 4:
        return ri(
          e,
          e.stateNode.containerInfo
        ), l = e.pendingProps, t === null ? e.child = oa(
          e,
          null,
          l,
          n
        ) : ce(t, e, l, n), e.child;
      case 11:
        return gg(
          t,
          e,
          e.type,
          e.pendingProps,
          n
        );
      case 7:
        return l = e.pendingProps, Ia(t, e), ce(t, e, l, n), e.child;
      case 8:
        return ce(
          t,
          e,
          e.pendingProps.children,
          n
        ), e.child;
      case 12:
        return ce(
          t,
          e,
          e.pendingProps.children,
          n
        ), e.child;
      case 10:
        return Dg(t, e, n);
      case 9:
        return r = e.type._context, l = e.pendingProps.children, na(e), r = Se(r), l = l(r), e.flags |= 1, ce(t, e, l, n), e.child;
      case 14:
        return yg(
          t,
          e,
          e.type,
          e.pendingProps,
          n
        );
      case 15:
        return vg(
          t,
          e,
          e.type,
          e.pendingProps,
          n
        );
      case 19:
        return Qc(t, e, n);
      case 31:
        return sE(t, e, n);
      case 22:
        return bg(
          t,
          e,
          n,
          e.pendingProps
        );
      case 24:
        return na(e), l = Se(se), t === null ? (r = rc(), r === null && (r = Pt, u = sc(), r.pooledCache = u, u.refCount++, u !== null && (r.pooledCacheLanes |= n), r = u), e.memoizedState = { parent: l, cache: r }, cc(e), pi(e, se, r)) : ((t.lanes & n) !== 0 && (fc(t, e), ls(e, null, null, n), as()), r = t.memoizedState, u = e.memoizedState, r.parent !== l ? (r = { parent: l, cache: l }, e.memoizedState = r, e.lanes === 0 && (e.memoizedState = e.updateQueue.baseState = r), pi(e, se, l)) : (l = u.cache, pi(e, se, l), l !== r.cache && lc(
          e,
          [se],
          n,
          !0
        ))), ce(
          t,
          e,
          e.pendingProps.children,
          n
        ), e.child;
      case 30:
        return e.stateNode === null && (e.stateNode = {
          autoName: null,
          paired: null,
          clones: null,
          ref: null
        }), l = e.pendingProps, l.name != null && l.name !== "auto" ? e.flags |= t === null ? 18882560 : 18874368 : Dt && wo(e), t !== null && t.memoizedProps.name !== l.name ? e.flags |= 4194816 : Ia(t, e), ce(t, e, l.children, n), e.child;
      case 29:
        throw e.pendingProps;
    }
    throw Error(o(156, e.tag));
  }
  function ti(t) {
    t.flags |= 4;
  }
  function Kc(t, e, n, l, r) {
    var u;
    if ((u = (t.mode & 32) !== 0) && (u = n === null ? a0(e, l) : a0(e, l) && (l.src !== n.src || l.srcSet !== n.srcSet)), u) {
      if (t.flags |= 16777216, (r & 335544128) === r)
        if (t.stateNode.complete) t.flags |= 8192;
        else if (cy()) t.flags |= 8192;
        else
          throw sa = _o, uc;
    } else t.flags &= -16777217;
  }
  function zg(t, e) {
    if (e.type !== "stylesheet" || (e.state.loading & 4) !== 0)
      t.flags &= -16777217;
    else if (t.flags |= 16777216, !l0(e))
      if (cy()) t.flags |= 8192;
      else
        throw sa = _o, uc;
  }
  function Wo(t, e) {
    e !== null && (t.flags |= 4), t.flags & 16384 && (e = t.tag !== 22 ? am() : 536870912, t.lanes |= e, nl |= e);
  }
  function fs(t, e) {
    if (!Dt)
      switch (t.tailMode) {
        case "visible":
          break;
        case "collapsed":
          for (var n = t.tail, l = null; n !== null; )
            n.alternate !== null && (l = n), n = n.sibling;
          l === null ? e || t.tail === null ? t.tail = null : t.tail.sibling = null : l.sibling = null;
          break;
        default:
          for (e = t.tail, n = null; e !== null; )
            e.alternate !== null && (n = e), e = e.sibling;
          n === null ? t.tail = null : n.sibling = null;
      }
  }
  function It(t) {
    var e = t.alternate !== null && t.alternate.child === t.child, n = 0, l = 0;
    if (e)
      for (var r = t.child; r !== null; )
        n |= r.lanes | r.childLanes, l |= r.subtreeFlags & 1206910976, l |= r.flags & 1206910976, r.return = t, r = r.sibling;
    else
      for (r = t.child; r !== null; )
        n |= r.lanes | r.childLanes, l |= r.subtreeFlags, l |= r.flags, r.return = t, r = r.sibling;
    return t.subtreeFlags |= l, t.childLanes = n, e;
  }
  function uE(t, e, n) {
    var l = e.pendingProps;
    switch (ec(e), e.tag) {
      case 16:
      case 15:
      case 0:
      case 11:
      case 7:
      case 8:
      case 12:
      case 9:
      case 14:
        return It(e), null;
      case 1:
        return It(e), null;
      case 3:
        return n = e.stateNode, l = null, t !== null && (l = t.memoizedState.cache), e.memoizedState.cache !== l && (e.flags |= 2048), Fn(se), Yn(), n.pendingContext && (n.context = n.pendingContext, n.pendingContext = null), (t === null || t.child === null) && (Qa(e) ? ti(e) : t === null || t.memoizedState.isDehydrated && (e.flags & 256) === 0 || (e.flags |= 1024, ic())), It(e), null;
      case 26:
        var r = e.type, u = e.memoizedState;
        return t === null ? (ti(e), u !== null ? (It(e), zg(e, u)) : (It(e), Kc(
          e,
          r,
          null,
          l,
          n
        ))) : u ? u !== t.memoizedState ? (ti(e), It(e), zg(e, u)) : (It(e), e.flags &= -16777217) : (t = t.memoizedProps, t !== l && ti(e), It(e), Kc(
          e,
          r,
          t,
          l,
          n
        )), null;
      case 27:
        if (Ca(e), n = Ve.current, r = e.type, t !== null && e.stateNode != null)
          t.memoizedProps !== l && ti(e);
        else {
          if (!l) {
            if (e.stateNode === null)
              throw Error(o(166));
            return It(e), e.subtreeFlags &= -33554433, null;
          }
          t = ie.current, Qa(e) ? rp(e) : (t = Fy(r, l, n), e.stateNode = t, ti(e));
        }
        return It(e), e.subtreeFlags &= -33554433, null;
      case 5:
        if (Ca(e), r = e.type, t !== null && e.stateNode != null)
          t.memoizedProps !== l && ti(e);
        else {
          if (!l) {
            if (e.stateNode === null)
              throw Error(o(166));
            return It(e), e.subtreeFlags &= -33554433, null;
          }
          if (u = ie.current, Qa(e))
            rp(e);
          else {
            var m = Es(
              Ve.current
            );
            switch (u) {
              case 1:
                u = m.createElementNS(
                  "http://www.w3.org/2000/svg",
                  r
                );
                break;
              case 2:
                u = m.createElementNS(
                  "http://www.w3.org/1998/Math/MathML",
                  r
                );
                break;
              default:
                switch (r) {
                  case "svg":
                    u = m.createElementNS(
                      "http://www.w3.org/2000/svg",
                      r
                    );
                    break;
                  case "math":
                    u = m.createElementNS(
                      "http://www.w3.org/1998/Math/MathML",
                      r
                    );
                    break;
                  case "script":
                    u = m.createElement("div"), u.innerHTML = "<script><\/script>", u = u.removeChild(
                      u.firstChild
                    );
                    break;
                  case "select":
                    u = typeof l.is == "string" ? m.createElement("select", {
                      is: l.is
                    }) : m.createElement("select"), l.multiple ? u.multiple = !0 : l.size && (u.size = l.size);
                    break;
                  default:
                    u = typeof l.is == "string" ? m.createElement(r, { is: l.is }) : m.createElement(r);
                }
            }
            u[be] = e, u[Le] = l;
            t: for (m = e.child; m !== null; ) {
              if (m.tag === 5 || m.tag === 6)
                u.appendChild(m.stateNode);
              else if (m.tag !== 4 && m.tag !== 27 && m.child !== null) {
                m.child.return = m, m = m.child;
                continue;
              }
              if (m === e) break t;
              for (; m.sibling === null; ) {
                if (m.return === null || m.return === e)
                  break t;
                m = m.return;
              }
              m.sibling.return = m.return, m = m.sibling;
            }
            e.stateNode = u;
            t: switch (xe(u, r, l), r) {
              case "button":
              case "input":
              case "select":
              case "textarea":
                l = !!l.autoFocus;
                break t;
              case "img":
                l = !0;
                break t;
              default:
                l = !1;
            }
            l && ti(e);
          }
        }
        return It(e), e.subtreeFlags &= -33554433, Kc(
          e,
          e.type,
          t === null ? null : t.memoizedProps,
          e.pendingProps,
          n
        ), null;
      case 6:
        if (t && e.stateNode != null)
          t.memoizedProps !== l && ti(e);
        else {
          if (typeof l != "string" && e.stateNode === null)
            throw Error(o(166));
          if (t = Ve.current, Qa(e)) {
            if (t = e.stateNode, n = e.memoizedProps, l = null, r = ge, r !== null)
              switch (r.tag) {
                case 27:
                case 5:
                  l = r.memoizedProps;
              }
            t[be] = e, t = !!(t.nodeValue === n || l !== null && l.suppressHydrationWarning === !0 || Oy(t.nodeValue, n)), t || mi(e, !0);
          } else
            t = Es(t).createTextNode(
              l
            ), t[be] = e, e.stateNode = t;
        }
        return It(e), null;
      case 31:
        if (n = e.memoizedState, t === null || t.memoizedState !== null) {
          if (l = Qa(e), n !== null) {
            if (t === null) {
              if (!l) throw Error(o(318));
              if (t = e.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(o(557));
              t[be] = e;
            } else
              $i(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
            It(e), t = !1;
          } else
            n = ic(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = n), t = !0;
          if (!t)
            return e.flags & 256 ? (ke(e), e) : (ke(e), null);
          if ((e.flags & 128) !== 0)
            throw Error(o(558));
        }
        return It(e), null;
      case 13:
        if (l = e.memoizedState, t === null || t.memoizedState !== null && t.memoizedState.dehydrated !== null) {
          if (r = Qa(e), l !== null && l.dehydrated !== null) {
            if (t === null) {
              if (!r) throw Error(o(318));
              if (r = e.memoizedState, r = r !== null ? r.dehydrated : null, !r) throw Error(o(317));
              r[be] = e;
            } else
              $i(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
            It(e), r = !1;
          } else
            r = ic(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = r), r = !0;
          if (!r)
            return e.flags & 256 ? (ke(e), e) : (ke(e), null);
        }
        return ke(e), (e.flags & 128) !== 0 ? (e.lanes = n, e) : (n = l !== null, t = t !== null && t.memoizedState !== null, n && (l = e.child, r = null, l.alternate !== null && l.alternate.memoizedState !== null && l.alternate.memoizedState.cachePool !== null && (r = l.alternate.memoizedState.cachePool.pool), u = null, l.memoizedState !== null && l.memoizedState.cachePool !== null && (u = l.memoizedState.cachePool.pool), u !== r && (l.flags |= 2048)), n !== t && n && (e.child.flags |= 8192), Wo(e, e.updateQueue), It(e), null);
      case 4:
        return Yn(), t === null && Df(e.stateNode.containerInfo), e.flags |= 67108864, It(e), null;
      case 10:
        return Fn(e.type), It(e), null;
      case 19:
        if (yc(e), l = e.memoizedState, l === null) return It(e), null;
        if (r = (e.flags & 128) !== 0, u = l.rendering, u === null)
          if (r) fs(l, !1);
          else {
            if (ne !== 0 || t !== null && (t.flags & 128) !== 0)
              for (t = e.child; t !== null; ) {
                if (u = Bo(t), u !== null) {
                  for (e.flags |= 128, fs(l, !1), t = u.updateQueue, e.updateQueue = t, Wo(e, t), e.subtreeFlags = 0, t = n, n = e.child; n !== null; )
                    ip(n, t), n = n.sibling;
                  return ss(
                    e,
                    Ee.current & 1 | 2
                  ), Dt && Pn(e, l.treeForkCount), e.child;
                }
                t = t.sibling;
              }
            l.tail !== null && we() > cr && (e.flags |= 128, r = !0, fs(l, !1), e.lanes = 4194304);
          }
        else {
          if (!r)
            if (t = Bo(u), t !== null) {
              if (e.flags |= 128, r = !0, t = t.updateQueue, e.updateQueue = t, Wo(e, t), fs(l, !0), l.tail === null && l.tailMode !== "collapsed" && l.tailMode !== "visible" && !u.alternate && !Dt)
                return It(e), null;
            } else
              2 * we() - l.renderingStartTime > cr && n !== 536870912 && (e.flags |= 128, r = !0, fs(l, !1), e.lanes = 4194304);
          l.isBackwards ? (u.sibling = e.child, e.child = u) : (t = l.last, t !== null ? t.sibling = u : e.child = u, l.last = u);
        }
        if (l.tail !== null) {
          t = l.tail;
          t: {
            for (n = t; n !== null; ) {
              if (n.alternate !== null) {
                n = !1;
                break t;
              }
              n = n.sibling;
            }
            n = !0;
          }
          return l.rendering = t, l.tail = t.sibling, l.renderingStartTime = we(), t.sibling = null, u = Ee.current, u = r ? u & 1 | 2 : u & 1, l.tailMode === "visible" || l.tailMode === "collapsed" || !n || Dt ? ss(e, u) : (n = u, Mt(Te, e), Mt(Ee, n), Ce === null && (Ce = e)), Dt && Pn(e, l.treeForkCount), t;
        }
        return It(e), null;
      case 22:
      case 23:
        return ke(e), pc(), l = e.memoizedState !== null, t !== null ? t.memoizedState !== null !== l && (e.flags |= 8192) : l && (e.flags |= 8192), l ? (n & 536870912) !== 0 && (e.flags & 128) === 0 && (It(e), e.subtreeFlags & 6 && (e.flags |= 8192)) : It(e), n = e.updateQueue, n !== null && Wo(e, n.retryQueue), n = null, t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (n = t.memoizedState.cachePool.pool), l = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (l = e.memoizedState.cachePool.pool), l !== n && (e.flags |= 2048), t !== null && Ut(aa), null;
      case 24:
        return n = null, t !== null && (n = t.memoizedState.cache), e.memoizedState.cache !== n && (e.flags |= 2048), Fn(se), It(e), null;
      case 25:
        return null;
      case 30:
        return e.flags |= 33554432, It(e), null;
    }
    throw Error(o(156, e.tag));
  }
  function cE(t, e) {
    switch (ec(e), e.tag) {
      case 1:
        return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
      case 3:
        return Fn(se), Yn(), t = e.flags, (t & 65536) !== 0 && (t & 128) === 0 ? (e.flags = t & -65537 | 128, e) : null;
      case 26:
      case 27:
      case 5:
        return Ca(e), null;
      case 31:
        if (e.memoizedState !== null) {
          if (ke(e), e.alternate === null)
            throw Error(o(340));
          $i();
        }
        return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
      case 13:
        if (ke(e), t = e.memoizedState, t !== null && t.dehydrated !== null) {
          if (e.alternate === null)
            throw Error(o(340));
          $i();
        }
        return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
      case 19:
        return yc(e), t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, t = e.memoizedState, t !== null && (t.rendering = null, t.tail = null), e.flags |= 4, e) : null;
      case 4:
        return Yn(), null;
      case 10:
        return Fn(e.type), null;
      case 22:
      case 23:
        return ke(e), pc(), t !== null && Ut(aa), t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
      case 24:
        return Fn(se), null;
      case 25:
        return null;
      default:
        return null;
    }
  }
  function Rg(t, e) {
    switch (ec(e), e.tag) {
      case 3:
        Fn(se), Yn();
        break;
      case 26:
      case 27:
      case 5:
        Ca(e);
        break;
      case 4:
        Yn();
        break;
      case 31:
        e.memoizedState !== null && ke(e);
        break;
      case 13:
        ke(e);
        break;
      case 19:
        yc(e);
        break;
      case 10:
        Fn(e.type);
        break;
      case 22:
      case 23:
        ke(e), pc(), t !== null && Ut(aa);
        break;
      case 24:
        Fn(se);
    }
  }
  function ds(t, e) {
    try {
      var n = e.updateQueue, l = n !== null ? n.lastEffect : null;
      if (l !== null) {
        var r = l.next;
        n = r;
        do {
          if ((n.tag & t) === t) {
            l = void 0;
            var u = n.create, m = n.inst;
            l = u(), m.destroy = l;
          }
          n = n.next;
        } while (n !== r);
      }
    } catch (b) {
      Zt(e, e.return, b);
    }
  }
  function Ai(t, e, n) {
    try {
      var l = e.updateQueue, r = l !== null ? l.lastEffect : null;
      if (r !== null) {
        var u = r.next;
        l = u;
        do {
          if ((l.tag & t) === t) {
            var m = l.inst, b = m.destroy;
            if (b !== void 0) {
              m.destroy = void 0, r = e;
              var x = n, V = b;
              try {
                V();
              } catch (Y) {
                Zt(
                  r,
                  x,
                  Y
                );
              }
            }
          }
          l = l.next;
        } while (l !== u);
      }
    } catch (Y) {
      Zt(e, e.return, Y);
    }
  }
  function Ng(t) {
    var e = t.updateQueue;
    if (e !== null) {
      var n = t.stateNode;
      try {
        Tp(e, n);
      } catch (l) {
        Zt(t, t.return, l);
      }
    }
  }
  function _g(t, e, n) {
    n.props = ua(
      t.type,
      t.memoizedProps
    ), n.state = t.memoizedState;
    try {
      n.componentWillUnmount();
    } catch (l) {
      Zt(t, e, l);
    }
  }
  function zn(t, e) {
    try {
      var n = t.ref;
      if (n !== null) {
        switch (t.tag) {
          case 26:
          case 27:
          case 5:
            var l = t.stateNode;
            break;
          case 30:
            var r = t.stateNode, u = Zn(t.memoizedProps, r);
            (r.ref === null || r.ref.name !== u) && (r.ref = Gy(u)), l = r.ref;
            break;
          case 7:
            if (t.stateNode === null) {
              var m = new We(t);
              y(
                t.child,
                !1,
                tA,
                m,
                void 0,
                void 0
              ), t.stateNode = m;
            }
            l = t.stateNode;
            break;
          default:
            l = t.stateNode;
        }
        typeof n == "function" ? t.refCleanup = n(l) : n.current = l;
      }
    } catch (b) {
      Zt(t, e, b);
    }
  }
  function Ae(t, e) {
    var n = t.ref, l = t.refCleanup;
    if (n !== null)
      if (typeof l == "function")
        try {
          l();
        } catch (r) {
          Zt(t, e, r);
        } finally {
          t.refCleanup = null, t = t.alternate, t != null && (t.refCleanup = null);
        }
      else if (typeof n == "function")
        try {
          n(null);
        } catch (r) {
          Zt(t, e, r);
        }
      else n.current = null;
  }
  function $o(t, e) {
    if ((t.tag === 5 || t.tag === 27 || t.tag === 6) && t.alternate === null && e !== null)
      for (var n = 0; n < e.length; n++)
        Ky(
          t.stateNode,
          e[n]
        );
  }
  function Vg(t) {
    for (var e = t.return; e !== null && (Pc(e) && Ky(t.stateNode, e.stateNode), !kc(e)); )
      e = e.return;
  }
  function hs(t) {
    for (var e = t.return; e !== null && (Pc(e) && eA(t.stateNode, e.stateNode), !kc(e)); )
      e = e.return;
  }
  function kc(t) {
    return t.tag === 5 || t.tag === 3 || t.tag === 27;
  }
  function Pc(t) {
    return t && t.tag === 7 && t.stateNode !== null;
  }
  function Jc(t) {
    var e = t.type, n = t.memoizedProps, l = t.stateNode;
    try {
      t: switch (e) {
        case "button":
        case "input":
        case "select":
        case "textarea":
          n.autoFocus && l.focus();
          break t;
        case "img":
          n.src ? l.src = n.src : n.srcSet && (l.srcset = n.srcSet);
      }
    } catch (r) {
      Zt(t, t.return, r);
    }
  }
  function Fc(t, e, n) {
    try {
      var l = t.stateNode;
      UE(l, t.type, n, e), l[Le] = e;
    } catch (r) {
      Zt(t, t.return, r);
    }
  }
  function Lg(t) {
    return t.tag === 5 || t.tag === 3 || t.tag === 26 || t.tag === 27 && zi(t.type) || t.tag === 4;
  }
  function Ic(t) {
    t: for (; ; ) {
      for (; t.sibling === null; ) {
        if (t.return === null || Lg(t.return)) return null;
        t = t.return;
      }
      for (t.sibling.return = t.return, t = t.sibling; t.tag !== 5 && t.tag !== 6 && t.tag !== 18; ) {
        if (t.tag === 27 && zi(t.type) || t.flags & 2 || t.child === null || t.tag === 4) continue t;
        t.child.return = t, t = t.child;
      }
      if (!(t.flags & 2)) return t.stateNode;
    }
  }
  function Wc(t, e, n, l) {
    var r = t.tag;
    if (r === 5 || r === 6)
      r = t.stateNode, e ? (n.nodeType === 9 ? n.body : n.nodeName === "HTML" ? n.ownerDocument.body : n).insertBefore(r, e) : (e = n.nodeType === 9 ? n.body : n.nodeName === "HTML" ? n.ownerDocument.body : n, e.appendChild(r), n = n._reactRootContainer, n != null || e.onclick !== null || (e.onclick = Cn)), $o(t, l), Bt = !0;
    else if (r !== 4 && (r === 27 && ($o(t, l), l = null, zi(t.type) && (n = t.stateNode, e = null)), t = t.child, t !== null))
      for (Wc(
        t,
        e,
        n,
        l
      ), t = t.sibling; t !== null; )
        Wc(
          t,
          e,
          n,
          l
        ), t = t.sibling;
  }
  function tr(t, e, n, l) {
    var r = t.tag;
    if (r === 5 || r === 6)
      r = t.stateNode, e ? n.insertBefore(r, e) : n.appendChild(r), $o(t, l), Bt = !0;
    else if (r !== 4 && (r === 27 && ($o(t, l), l = null, zi(t.type) && (n = t.stateNode)), t = t.child, t !== null))
      for (tr(
        t,
        e,
        n,
        l
      ), t = t.sibling; t !== null; )
        tr(
          t,
          e,
          n,
          l
        ), t = t.sibling;
  }
  function Ug(t) {
    var e = t.stateNode, n = t.memoizedProps;
    try {
      for (var l = t.type, r = e.attributes; r.length; )
        e.removeAttributeNode(r[0]);
      xe(e, l, n), e[be] = t, e[Le] = n;
    } catch (u) {
      Zt(t, t.return, u);
    }
  }
  var er = !1, Pe = null;
  function Bg(t) {
    (t.tag === 30 || (t.subtreeFlags & 33554432) !== 0) && (er = !0);
  }
  var Rn = null;
  function Hg() {
    var t = Rn;
    return Rn = null, t;
  }
  var Be = 0;
  function Wa(t, e, n, l, r) {
    return Be = 0, jg(
      t.child,
      e,
      n,
      l,
      r
    );
  }
  function jg(t, e, n, l, r) {
    for (var u = !1; t !== null; ) {
      if (t.tag === 5) {
        var m = t.stateNode;
        if (l !== null) {
          var b = Uf(m);
          l.push(b), b.view && (u = !0);
        } else
          u || Uf(m).view && (u = !0);
        er = !0, Hy(
          m,
          Be === 0 ? e : e + "_" + Be,
          n
        ), Be++;
      } else (t.tag !== 22 || t.memoizedState === null) && (t.tag === 30 && r || jg(
        t.child,
        e,
        n,
        l,
        r
      ) && (u = !0));
      t = t.sibling;
    }
    return u;
  }
  function Nn(t, e) {
    for (; t !== null; )
      t.tag === 5 ? jy(t.stateNode, t.memoizedProps) : (t.tag !== 22 || t.memoizedState === null) && (t.tag === 30 && e || Nn(
        t.child,
        e
      )), t = t.sibling;
  }
  function nr(t) {
    if ((t.subtreeFlags & 18874368) !== 0)
      for (t = t.child; t !== null; ) {
        if ((t.tag !== 22 || t.memoizedState === null) && (nr(t), t.tag === 30 && (t.flags & 18874368) !== 0 && t.stateNode.paired)) {
          var e = t.memoizedProps;
          if (e.name == null || e.name === "auto")
            throw Error(o(544));
          var n = e.name;
          e = Kn(e.default, e.share), e !== "none" && (Wa(
            t,
            n,
            e,
            null,
            !1
          ) || Nn(t.child, !1));
        }
        t = t.sibling;
      }
  }
  function $c(t, e) {
    if (t.tag === 30) {
      var n = t.stateNode, l = t.memoizedProps, r = Zn(l, n), u = Kn(
        l.default,
        n.paired ? l.share : l.enter
      );
      u !== "none" ? Wa(t, r, u, null, !1) ? (nr(t), n.paired || e || sl(t, l.onEnter)) : Nn(t.child, !1) : nr(t);
    } else if ((t.subtreeFlags & 33554432) !== 0)
      for (t = t.child; t !== null; )
        $c(t, e), t = t.sibling;
    else nr(t);
  }
  function tf(t) {
    if (Pe !== null && Pe.size !== 0) {
      var e = Pe;
      if ((t.subtreeFlags & 18874368) !== 0)
        for (t = t.child; t !== null; ) {
          if (t.tag !== 22 || t.memoizedState === null) {
            if (t.tag === 30 && (t.flags & 18874368) !== 0) {
              var n = t.memoizedProps, l = n.name;
              if (l != null && l !== "auto") {
                var r = e.get(l);
                if (r !== void 0) {
                  var u = Kn(
                    n.default,
                    n.share
                  );
                  if (u !== "none" && (Wa(
                    t,
                    l,
                    u,
                    null,
                    !1
                  ) ? (u = t.stateNode, r.paired = u, u.paired = r, sl(t, n.onShare)) : Nn(t.child, !1)), e.delete(l), e.size === 0) break;
                }
              }
            }
            tf(t);
          }
          t = t.sibling;
        }
    }
  }
  function ef(t) {
    if (t.tag === 30) {
      var e = t.memoizedProps, n = Zn(e, t.stateNode), l = Pe !== null ? Pe.get(n) : void 0, r = Kn(
        e.default,
        l !== void 0 ? e.share : e.exit
      );
      r !== "none" && (Wa(t, n, r, null, !1) ? l !== void 0 ? (r = t.stateNode, l.paired = r, r.paired = l, Pe.delete(n), sl(t, e.onShare)) : sl(t, e.onExit) : Nn(t.child, !1)), Pe !== null && tf(t);
    } else if ((t.subtreeFlags & 33554432) !== 0)
      for (t = t.child; t !== null; )
        ef(t), t = t.sibling;
    else
      Pe !== null && tf(t);
  }
  function Gg(t) {
    for (t = t.child; t !== null; ) {
      if (t.tag === 30) {
        var e = t.memoizedProps, n = Zn(e, t.stateNode);
        e = Kn(e.default, e.update), t.flags &= -5, e !== "none" && Wa(
          t,
          n,
          e,
          t.memoizedState = [],
          !1
        );
      } else
        (t.subtreeFlags & 33554432) !== 0 && Gg(t);
      t = t.sibling;
    }
  }
  function nf(t) {
    if ((t.subtreeFlags & 18874368) !== 0)
      for (t = t.child; t !== null; ) {
        if (t.tag !== 22 || t.memoizedState === null) {
          if (t.tag === 30 && (t.flags & 18874368) !== 0) {
            var e = t.stateNode;
            e.paired !== null && (e.paired = null, Nn(t.child, !1));
          }
          nf(t);
        }
        t = t.sibling;
      }
  }
  function ir(t) {
    if (t.tag === 30)
      t.stateNode.paired = null, Nn(t.child, !1), nf(t);
    else if ((t.subtreeFlags & 33554432) !== 0)
      for (t = t.child; t !== null; )
        ir(t), t = t.sibling;
    else nf(t);
  }
  function Yg(t) {
    for (t = t.child; t !== null; )
      t.tag === 30 ? Nn(t.child, !1) : (t.subtreeFlags & 33554432) !== 0 && Yg(t), t = t.sibling;
  }
  function af(t, e, n, l, r, u, m) {
    for (var b = !1; e !== null; ) {
      if (e.tag === 5) {
        var x = e.stateNode;
        if (u !== null && Be < u.length) {
          var V = u[Be], Y = Uf(x);
          (V.view || Y.view) && (b = !0);
          var Z;
          if (Z = (t.flags & 4) === 0)
            if (Y.clip) Z = !0;
            else {
              Z = V.rect;
              var R = Y.rect;
              Z = Z.y !== R.y || Z.x !== R.x || Z.height !== R.height || Z.width !== R.width;
            }
          Z && (t.flags |= 4), Y.abs ? Y = !V.abs : (V = V.rect, Y = Y.rect, Y = V.height !== Y.height || V.width !== Y.width), Y && (t.flags |= 32);
        } else t.flags |= 32;
        (t.flags & 4) !== 0 && Hy(
          x,
          Be === 0 ? n : n + "_" + Be,
          r
        ), b && (t.flags & 4) !== 0 || (Rn === null && (Rn = []), Rn.push(
          x,
          Be === 0 ? l : l + "_" + Be,
          e.memoizedProps
        )), Be++;
      } else (e.tag !== 22 || e.memoizedState === null) && (e.tag === 30 && m ? t.flags |= e.flags & 32 : af(
        t,
        e.child,
        n,
        l,
        r,
        u,
        m
      ) && (b = !0));
      e = e.sibling;
    }
    return b;
  }
  function qg(t, e) {
    for (t = t.child; t !== null; ) {
      if (t.tag === 30) {
        var n = t.memoizedProps, l = t.stateNode, r = Zn(n, l), u = Kn(n.default, n.update), m;
        m = t.memoizedState, t.memoizedState = null, l = t;
        var b = t.child;
        Be = 0, r = af(
          l,
          b,
          r,
          r,
          u,
          m,
          !1
        ), (t.flags & 4) !== 0 && r && sl(t, n.onUpdate);
      } else
        (t.subtreeFlags & 33554432) !== 0 && qg(t);
      t = t.sibling;
    }
  }
  var ye = !1, Yt = !1, _n = !1, lf = !1, Xg = typeof WeakSet == "function" ? WeakSet : Set, ve = null, Vn = !1, ms = !1, ar = !1, sf = !1;
  function fE(t, e, n) {
    if (t = t.containerInfo, Rf = gl, t = km(t), Zu(t)) {
      if ("selectionStart" in t)
        var l = {
          start: t.selectionStart,
          end: t.selectionEnd
        };
      else
        t: {
          l = (l = t.ownerDocument) && l.defaultView || window;
          var r = l.getSelection && l.getSelection();
          if (r && r.rangeCount !== 0) {
            l = r.anchorNode;
            var u = r.anchorOffset, m = r.focusNode;
            r = r.focusOffset;
            try {
              l.nodeType, m.nodeType;
            } catch {
              l = null;
              break t;
            }
            var b = 0, x = -1, V = -1, Y = 0, Z = 0, R = t, j = null;
            e: for (; ; ) {
              for (var ot; R !== l || u !== 0 && R.nodeType !== 3 || (x = b + u), R !== m || r !== 0 && R.nodeType !== 3 || (V = b + r), R.nodeType === 3 && (b += R.nodeValue.length), (ot = R.firstChild) !== null; )
                j = R, R = ot;
              for (; ; ) {
                if (R === t) break e;
                if (j === l && ++Y === u && (x = b), j === m && ++Z === r && (V = b), (ot = R.nextSibling) !== null) break;
                R = j, j = R.parentNode;
              }
              R = ot;
            }
            l = x === -1 || V === -1 ? null : { start: x, end: V };
          } else l = null;
        }
      l = l || { start: 0, end: 0 };
    } else l = null;
    for (Nf = { focusedElem: t, selectionRange: l }, gl = !1, n = (n & 335544064) === n, ve = e, e = n ? 9270 : 1024; ve !== null; ) {
      if (t = ve, n && (l = t.deletions, l !== null))
        for (u = 0; u < l.length; u++)
          n && ef(l[u]);
      if (t.alternate === null && (t.flags & 2) !== 0)
        n && Bg(t), lr(n);
      else {
        if (t.tag === 22) {
          if (l = t.alternate, t.memoizedState !== null) {
            l !== null && l.memoizedState === null && n && ef(l), lr(n);
            continue;
          } else if (l !== null && l.memoizedState !== null) {
            n && Bg(t), lr(n);
            continue;
          }
        }
        l = t.child, (t.subtreeFlags & e) !== 0 && l !== null ? (l.return = t, ve = l) : (n && Gg(t), lr(n));
      }
    }
    Pe = null;
  }
  function lr(t) {
    for (; ve !== null; ) {
      var e = ve, n = t, l = e.alternate, r = e.flags;
      switch (e.tag) {
        case 0:
        case 11:
        case 15:
          break;
        case 1:
          if ((r & 1024) !== 0 && l !== null) {
            n = void 0, r = l.memoizedProps, l = l.memoizedState;
            var u = e.stateNode;
            try {
              var m = ua(
                e.type,
                r
              );
              n = u.getSnapshotBeforeUpdate(
                m,
                l
              ), u.__reactInternalSnapshotBeforeUpdate = n;
            } catch (b) {
              Zt(e, e.return, b);
            }
          }
          break;
        case 3:
          if ((r & 1024) !== 0) {
            if (l = e.stateNode.containerInfo, n = l.nodeType, n === 9)
              jf(l);
            else if (n === 1)
              switch (l.nodeName) {
                case "HEAD":
                case "HTML":
                case "BODY":
                  jf(l);
                  break;
                default:
                  l.textContent = "";
              }
          }
          break;
        case 5:
        case 26:
        case 27:
        case 6:
        case 4:
        case 17:
          break;
        case 30:
          n && l !== null && (n = Zn(
            l.memoizedProps,
            l.stateNode
          ), r = e.memoizedProps, r = Kn(r.default, r.update), r !== "none" && Wa(
            l,
            n,
            r,
            l.memoizedState = [],
            !0
          ));
          break;
        default:
          if ((r & 1024) !== 0) throw Error(o(163));
      }
      if (l = e.sibling, l !== null) {
        l.return = e.return, ve = l;
        break;
      }
      ve = e.return;
    }
  }
  function Qg(t, e, n) {
    var l = n.flags;
    switch (n.tag) {
      case 0:
      case 11:
      case 15:
        Ln(t, n), l & 4 && ds(5, n);
        break;
      case 1:
        if (Ln(t, n), l & 4)
          if (t = n.stateNode, e === null)
            try {
              t.componentDidMount();
            } catch (m) {
              Zt(n, n.return, m);
            }
          else {
            var r = ua(
              n.type,
              e.memoizedProps
            );
            e = e.memoizedState;
            try {
              t.componentDidUpdate(
                r,
                e,
                t.__reactInternalSnapshotBeforeUpdate
              );
            } catch (m) {
              Zt(
                n,
                n.return,
                m
              );
            }
          }
        l & 64 && Ng(n), l & 512 && zn(n, n.return);
        break;
      case 3:
        if (Ln(t, n), l & 64 && (t = n.updateQueue, t !== null)) {
          if (e = null, n.child !== null)
            switch (n.child.tag) {
              case 27:
              case 5:
                e = n.child.stateNode;
                break;
              case 1:
                e = n.child.stateNode;
            }
          try {
            Tp(t, e);
          } catch (m) {
            Zt(n, n.return, m);
          }
        }
        break;
      case 27:
        e === null && l & 4 && Ug(n);
      case 26:
      case 5:
        Ln(t, n), e === null && l & 4 && Jc(n), l & 512 && zn(n, n.return);
        break;
      case 12:
        Ln(t, n);
        break;
      case 31:
        Ln(t, n), l & 4 && Pg(t, n);
        break;
      case 13:
        Ln(t, n), l & 4 && Jg(t, n), l & 64 && (t = n.memoizedState, t !== null && (t = t.dehydrated, t !== null && (n = AE.bind(
          null,
          n
        ), aA(t, n))));
        break;
      case 22:
        if (l = n.memoizedState !== null || ye, !l) {
          var u = e !== null && e.memoizedState !== null || Yt;
          e = ye, r = Yt, ye = l, (Yt = u) && !r ? (l = 2, (n.subtreeFlags & 8772) !== 0 && (l |= 1), gn(
            t,
            n,
            l
          )) : Ln(t, n), ye = e, Yt = r;
        }
        break;
      case 30:
        Ln(t, n), l & 512 && zn(n, n.return);
        break;
      case 7:
        l & 512 && zn(n, n.return);
      default:
        Ln(t, n);
    }
  }
  function of(t, e) {
    for (t = t.child; t !== null; )
      Zg(t, e), t = t.sibling;
  }
  function Zg(t, e) {
    switch (t.tag) {
      case 5:
      case 26:
        try {
          var n = t.stateNode;
          if (e) {
            var l = n.style;
            typeof l.setProperty == "function" ? l.setProperty("display", "none", "important") : l.display = "none";
          } else {
            var r = t.stateNode, u = t.memoizedProps.style, m = u != null && u.hasOwnProperty("display") ? u.display : null;
            r.style.display = m == null || typeof m == "boolean" ? "" : ("" + m).trim();
          }
        } catch (x) {
          Zt(t, t.return, x);
        }
        rf(t, e);
        break;
      case 6:
        try {
          t.stateNode.nodeValue = e ? "" : t.memoizedProps, Bt = !0;
        } catch (x) {
          Zt(t, t.return, x);
        }
        break;
      case 18:
        try {
          var b = t.stateNode;
          e ? By(b, !0) : By(t.stateNode, !1);
        } catch (x) {
          Zt(t, t.return, x);
        }
        break;
      case 22:
      case 23:
        t.memoizedState === null && of(t, e);
        break;
      default:
        of(t, e);
    }
  }
  function rf(t, e) {
    if (t.subtreeFlags & 67108864)
      for (t = t.child; t !== null; ) {
        t: {
          var n = t, l = e;
          switch (n.tag) {
            case 4:
              Zg(n, l);
              break t;
            case 22:
              n.memoizedState === null && rf(n, l);
              break t;
            default:
              rf(n, l);
          }
        }
        t = t.sibling;
      }
  }
  function Kg(t) {
    var e = t.alternate;
    e !== null && (t.alternate = null, Kg(e)), t.child = null, t.deletions = null, t.sibling = null, t.tag === 5 && (e = t.stateNode, e !== null && uo(e)), t.stateNode = null, t.return = null, t.dependencies = null, t.memoizedProps = null, t.memoizedState = null, t.pendingProps = null, t.stateNode = null, t.updateQueue = null;
  }
  var Wt = null, He = !1;
  function mn(t, e, n) {
    for (n = n.child; n !== null; )
      kg(t, e, n), n = n.sibling;
  }
  function kg(t, e, n) {
    if (Xe && typeof Xe.onCommitFiberUnmount == "function")
      try {
        Xe.onCommitFiberUnmount(Bl, n);
      } catch {
      }
    switch (n.tag) {
      case 26:
        Yt || Ae(n, e), mn(
          t,
          e,
          n
        ), n.memoizedState ? n.memoizedState.count-- : n.stateNode && !Yt && (n = n.stateNode, n.parentNode.removeChild(n));
        break;
      case 27:
        Yt || Ae(n, e), hs(n);
        var l = Wt, r = He;
        zi(n.type) && (Wt = n.stateNode, He = !1), mn(
          t,
          e,
          n
        ), Iy(
          n.stateNode,
          n.type,
          n.memoizedProps
        ), Wt = l, He = r;
        break;
      case 5:
        Yt || Ae(n, e), hs(n);
      case 6:
        if (n.tag === 6 && hs(n), l = Wt, r = He, Wt = null, mn(
          t,
          e,
          n
        ), Wt = l, He = r, Wt !== null)
          if (He)
            try {
              (Wt.nodeType === 9 ? Wt.body : Wt.nodeName === "HTML" ? Wt.ownerDocument.body : Wt).removeChild(n.stateNode), Bt = !0;
            } catch (u) {
              Zt(
                n,
                e,
                u
              );
            }
          else
            try {
              Wt.removeChild(n.stateNode), Bt = !0;
            } catch (u) {
              Zt(
                n,
                e,
                u
              );
            }
        break;
      case 18:
        Wt !== null && (He ? (t = Wt, Uy(
          t.nodeType === 9 ? t.body : t.nodeName === "HTML" ? t.ownerDocument.body : t,
          n.stateNode
        ), yl(t)) : Uy(Wt, n.stateNode));
        break;
      case 4:
        l = Wt, r = He, Wt = n.stateNode.containerInfo, He = !0, mn(
          t,
          e,
          n
        ), Wt = l, He = r;
        break;
      case 0:
      case 11:
      case 14:
      case 15:
        Ai(2, n, e), Yt || Ai(4, n, e), mn(
          t,
          e,
          n
        );
        break;
      case 1:
        Yt || (Ae(n, e), l = n.stateNode, typeof l.componentWillUnmount == "function" && _g(
          n,
          e,
          l
        )), mn(
          t,
          e,
          n
        );
        break;
      case 21:
        mn(
          t,
          e,
          n
        );
        break;
      case 22:
        Yt = (l = Yt) || n.memoizedState !== null, mn(
          t,
          e,
          n
        ), Yt = l;
        break;
      case 30:
        Ae(n, e), mn(
          t,
          e,
          n
        );
        break;
      case 7:
        Yt || Ae(n, e), mn(
          t,
          e,
          n
        );
        break;
      default:
        mn(
          t,
          e,
          n
        );
    }
  }
  function Pg(t, e) {
    if (e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null))) {
      t = t.dehydrated;
      try {
        yl(t);
      } catch (n) {
        Zt(e, e.return, n);
      }
    }
  }
  function Jg(t, e) {
    if (e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null && (t = t.dehydrated, t !== null))))
      try {
        yl(t);
      } catch (n) {
        Zt(e, e.return, n);
      }
  }
  function dE(t) {
    switch (t.tag) {
      case 31:
      case 13:
      case 19:
        var e = t.stateNode;
        return e === null && (e = t.stateNode = new Xg()), e;
      case 22:
        return t = t.stateNode, e = t._retryCache, e === null && (e = t._retryCache = new Xg()), e;
      default:
        throw Error(o(435, t.tag));
    }
  }
  function sr(t, e) {
    var n = dE(t);
    e.forEach(function(l) {
      if (!n.has(l)) {
        n.add(l);
        var r = xE.bind(null, t, l);
        l.then(r, r);
      }
    });
  }
  function Ne(t, e, n) {
    var l = e.deletions;
    if (l !== null)
      for (var r = 0; r < l.length; r++) {
        var u = l[r], m = t, b = e, x = b;
        t: for (; x !== null; ) {
          switch (x.tag) {
            case 27:
              if (zi(x.type)) {
                Wt = x.stateNode, He = !1;
                break t;
              }
              break;
            case 5:
              Wt = x.stateNode, He = !1;
              break t;
            case 3:
            case 4:
              Wt = x.stateNode.containerInfo, He = !0;
              break t;
          }
          x = x.return;
        }
        if (Wt === null) throw Error(o(160));
        kg(m, b, u), Wt = null, He = !1, m = u.alternate, m !== null && (m.return = null), u.return = null;
      }
    if (e.subtreeFlags & 13886)
      for (e = e.child; e !== null; )
        Fg(e, t, n), e = e.sibling;
  }
  var pn = null;
  function Fg(t, e, n) {
    var l = t.alternate, r = t.flags;
    switch (t.tag) {
      case 0:
      case 11:
      case 14:
      case 15:
        if (r & 4 && (l = t.updateQueue, l = l !== null ? l.events : null, l !== null))
          for (var u = 0; u < l.length; u++) {
            var m = l[u];
            m.ref.impl = m.nextImpl;
          }
        Ne(e, t, n), _e(t), r & 4 && (Ai(3, t, t.return), ds(3, t), Ai(5, t, t.return));
        break;
      case 1:
        Ne(e, t, n), _e(t), r & 512 && (Yt || l === null || Ae(l, l.return)), r & 64 && ye && (t = t.updateQueue, t !== null && (e = t.callbacks, e !== null && (n = t.shared.hiddenCallbacks, t.shared.hiddenCallbacks = n === null ? e : n.concat(e))));
        break;
      case 26:
        if (u = pn, Ne(e, t, n), _e(t), r & 512 && (Yt || l === null || Ae(l, l.return)), r & 4)
          if (r = l !== null ? l.memoizedState : null, n = t.memoizedState, l === null)
            if (n === null)
              if (t.stateNode === null)
                if (ye)
                  t.stateNode = _y(
                    t.type,
                    t.memoizedProps,
                    e.containerInfo,
                    t
                  );
                else {
                  t: {
                    e = t.type, n = t.memoizedProps, r = u.ownerDocument || u;
                    e: switch (e) {
                      case "title":
                        l = r.getElementsByTagName("title")[0], (!l || l[Gl] || l[be] || l.namespaceURI === "http://www.w3.org/2000/svg" || l.hasAttribute("itemprop")) && (l = r.createElement(e), r.head.insertBefore(
                          l,
                          r.querySelector("head > title")
                        )), xe(l, e, n), l[be] = t, pe(l), e = l;
                        break t;
                      case "link":
                        if (u = i0(
                          "link",
                          "href",
                          r
                        ).get(e + (n.href || ""))) {
                          for (m = 0; m < u.length; m++)
                            if (l = u[m], l.getAttribute("href") === (n.href == null || n.href === "" ? null : n.href) && l.getAttribute("rel") === (n.rel == null ? null : n.rel) && l.getAttribute("title") === (n.title == null ? null : n.title) && l.getAttribute("crossorigin") === (n.crossOrigin == null ? null : n.crossOrigin)) {
                              u.splice(m, 1);
                              break e;
                            }
                        }
                        l = r.createElement(e), xe(l, e, n), r.head.appendChild(l);
                        break;
                      case "meta":
                        if (u = i0(
                          "meta",
                          "content",
                          r
                        ).get(e + (n.content || ""))) {
                          for (m = 0; m < u.length; m++)
                            if (l = u[m], l.getAttribute("content") === (n.content == null ? null : "" + n.content) && l.getAttribute("name") === (n.name == null ? null : n.name) && l.getAttribute("property") === (n.property == null ? null : n.property) && l.getAttribute("http-equiv") === (n.httpEquiv == null ? null : n.httpEquiv) && l.getAttribute("charset") === (n.charSet == null ? null : n.charSet)) {
                              u.splice(m, 1);
                              break e;
                            }
                        }
                        l = r.createElement(e), xe(l, e, n), r.head.appendChild(l);
                        break;
                      default:
                        throw Error(o(468, e));
                    }
                    l[be] = t, pe(l), e = l;
                  }
                  t.stateNode = e;
                }
              else
                ye || Kf(u, t.type, t.stateNode);
            else
              t.stateNode = n0(
                u,
                n,
                t.memoizedProps
              );
          else
            r !== n ? (r === null ? (e = l.stateNode, e === null || Yt || e.parentNode.removeChild(e)) : r.count--, n === null ? ye || Kf(u, t.type, t.stateNode) : n0(u, n, t.memoizedProps)) : n === null && t.stateNode !== null && Fc(
              t,
              t.memoizedProps,
              l.memoizedProps
            );
        break;
      case 27:
        Ne(e, t, n), _e(t), r & 512 && (Yt || l === null || Ae(l, l.return)), l !== null && r & 4 && Fc(
          t,
          t.memoizedProps,
          l.memoizedProps
        );
        break;
      case 5:
        if (u = _n, _n = !1, Ne(e, t, n), _n = u, _e(t), r & 512 && (Yt || l === null || Ae(l, l.return)), t.flags & 32) {
          e = t.stateNode;
          try {
            Va(e, ""), Bt = !0;
          } catch (Y) {
            Zt(t, t.return, Y);
          }
        }
        r & 4 && t.stateNode != null && (e = t.memoizedProps, Fc(
          t,
          e,
          l !== null ? l.memoizedProps : e
        )), r & 1024 && (lf = !0);
        break;
      case 6:
        if (Ne(e, t, n), _e(t), r & 4) {
          if (t.stateNode === null)
            throw Error(o(162));
          e = t.memoizedProps, n = t.stateNode;
          try {
            n.nodeValue = e, Bt = !0;
          } catch (Y) {
            Zt(t, t.return, Y);
          }
        }
        break;
      case 3:
        if (Bt = !1, Tr = null, u = pn, pn = As(e.containerInfo), Ne(e, t, n), pn = u, _e(t), r & 4 && l !== null && l.memoizedState.isDehydrated)
          try {
            yl(e.containerInfo);
          } catch (Y) {
            Zt(t, t.return, Y);
          }
        lf && (lf = !1, Ig(t)), Bt = !1;
        break;
      case 4:
        r = _n, _n = ye, l = ym(), u = pn, pn = As(
          t.stateNode.containerInfo
        ), Ne(e, t, n), _e(t), pn = u, Bt && ms && (ar = !0), Bt = l, _n = r;
        break;
      case 12:
        Ne(e, t, n), _e(t);
        break;
      case 31:
        Ne(e, t, n), _e(t), r & 4 && (e = t.updateQueue, e !== null && (t.updateQueue = null, sr(t, e)));
        break;
      case 13:
        Ne(e, t, n), _e(t), t.child.flags & 8192 && t.memoizedState !== null != (l !== null && l.memoizedState !== null) && (ur = we()), r & 4 && (e = t.updateQueue, e !== null && (t.updateQueue = null, sr(t, e)));
        break;
      case 22:
        u = t.memoizedState !== null, m = l !== null && l.memoizedState !== null;
        var b = ye, x = Yt, V = _n;
        ye = b || u, _n = V || u, Yt = x || m, Ne(e, t, n), Yt = x, _n = V, ye = b, _e(t), r & 8192 && (e = t.stateNode, e._visibility = u ? e._visibility & -2 : e._visibility | 1, !u || l === null || m || ye || Yt || (e = m || Yt, n = ye, l = Yt, ye = u || ye, Yt = e, xi(t, 2), ye = n, Yt = l), !u && _n || of(t, u)), r & 4 && (e = t.updateQueue, e !== null && (n = e.retryQueue, n !== null && (e.retryQueue = null, sr(t, n))));
        break;
      case 19:
        Ne(e, t, n), _e(t), r & 4 && (e = t.updateQueue, e !== null && (t.updateQueue = null, sr(t, e)));
        break;
      case 30:
        r & 512 && (Yt || l === null || Ae(l, l.return)), r = ym(), u = ms, m = (n & 335544064) === n, b = t.memoizedProps, ms = m && Kn(
          b.default,
          b.update
        ) !== "none", Ne(e, t, n), _e(t), m && l !== null && Bt && (t.flags |= 4), ms = u, Bt = r;
        break;
      case 21:
        break;
      case 7:
        r & 512 && (Yt || l === null || Ae(l, l.return)), l && l.stateNode !== null && (l.stateNode._fragmentFiber = t);
      default:
        Ne(e, t, n), _e(t);
    }
  }
  function _e(t) {
    var e = t.flags;
    if (e & 2) {
      try {
        for (var n, l = t.return; l !== null; ) {
          if (Lg(l)) {
            n = l;
            break;
          }
          l = l.return;
        }
        l = null;
        for (var r = t.return; r !== null; ) {
          if (Pc(r)) {
            var u = r.stateNode;
            l === null ? l = [u] : l.push(u);
          }
          if (kc(r)) break;
          r = r.return;
        }
        var m = l;
        if (n == null) throw Error(o(160));
        switch (n.tag) {
          case 27:
            var b = n.stateNode, x = Ic(t);
            tr(
              t,
              x,
              b,
              m
            );
            break;
          case 5:
            var V = n.stateNode;
            n.flags & 32 && (Va(V, ""), n.flags &= -33);
            var Y = Ic(t);
            tr(
              t,
              Y,
              V,
              m
            );
            break;
          case 3:
          case 4:
            var Z = n.stateNode.containerInfo, R = Ic(t);
            Wc(
              t,
              R,
              Z,
              m
            );
            break;
          default:
            throw Error(o(161));
        }
      } catch (j) {
        Zt(t, t.return, j);
      }
      t.flags &= -3;
    }
    e & 4096 && (t.flags &= -4097);
  }
  function Ig(t) {
    if (t.subtreeFlags & 1024)
      for (t = t.child; t !== null; ) {
        var e = t;
        Ig(e), e.tag === 5 && e.flags & 1024 && (e = e.stateNode, gl = !0, e.reset(), gl = !1), t = t.sibling;
      }
  }
  function $a(t, e) {
    if (e.subtreeFlags & 9270)
      for (e = e.child; e !== null; )
        Wg(e, t), e = e.sibling;
    else qg(e);
  }
  function Wg(t, e) {
    var n = t.alternate;
    if (n === null) $c(t, !1);
    else
      switch (t.tag) {
        case 3:
          if (sf = Vn = !1, Hg(), $a(e, t), !Vn && !ar) {
            if (t = Rn, t !== null)
              for (var l = 0; l < t.length; l += 3) {
                n = t[l];
                var r = t[l + 1];
                jy(n, t[l + 2]), n = n.ownerDocument.documentElement, n !== null && n.animate(
                  { opacity: [0, 0], pointerEvents: ["none", "none"] },
                  {
                    duration: 0,
                    fill: "forwards",
                    pseudoElement: "::view-transition-group(" + r + ")"
                  }
                );
              }
            t = e.containerInfo, t = t.nodeType === 9 ? t.documentElement : t.ownerDocument.documentElement, t !== null && t.style.viewTransitionName === "" && (t.style.viewTransitionName = "none", t.animate(
              { opacity: [0, 0], pointerEvents: ["none", "none"] },
              {
                duration: 0,
                fill: "forwards",
                pseudoElement: "::view-transition-group(root)"
              }
            ), t.animate(
              { width: [0, 0], height: [0, 0] },
              {
                duration: 0,
                fill: "forwards",
                pseudoElement: "::view-transition"
              }
            )), sf = !0;
          }
          Rn = null;
          break;
        case 5:
          $a(e, t);
          break;
        case 4:
          l = Vn, Vn = !1, $a(e, t), Vn && (ar = !0), Vn = l;
          break;
        case 22:
          t.memoizedState === null && (n.memoizedState !== null ? $c(t, !1) : $a(e, t));
          break;
        case 30:
          l = Vn, r = Hg(), Vn = !1, $a(e, t), Vn && (t.flags |= 4);
          var u = t.memoizedProps, m = t.stateNode;
          e = Zn(u, m), m = Zn(n.memoizedProps, m);
          var b = Kn(u.default, u.update);
          b === "none" ? e = !1 : (u = n.memoizedState, n.memoizedState = null, n = t.child, Be = 0, e = af(
            t,
            n,
            e,
            m,
            b,
            u,
            !0
          ), Be !== (u === null ? 0 : u.length) && (t.flags |= 32)), (t.flags & 4) !== 0 && e ? (sl(
            t,
            t.memoizedProps.onUpdate
          ), Rn = r) : r !== null && (r.push.apply(r, Rn), Rn = r), Vn = (t.flags & 32) !== 0 ? !0 : l;
          break;
        default:
          $a(e, t);
      }
  }
  function Ln(t, e) {
    if (e.subtreeFlags & 8772)
      for (e = e.child; e !== null; )
        Qg(t, e.alternate, e), e = e.sibling;
  }
  function xi(t, e) {
    for (t = t.child; t !== null; ) {
      var n = t, l = e;
      switch (n.tag) {
        case 0:
        case 11:
        case 14:
        case 15:
          Ai(4, n, n.return), xi(
            n,
            l
          );
          break;
        case 1:
          Ae(n, n.return);
          var r = n.stateNode;
          typeof r.componentWillUnmount == "function" && _g(
            n,
            n.return,
            r
          ), xi(
            n,
            l
          );
          break;
        case 27:
          (l & 2) !== 0 && Iy(
            n.stateNode,
            n.type,
            n.memoizedProps
          );
        case 5:
          Ae(n, n.return), n.tag !== 5 && n.tag !== 27 || hs(n), xi(
            n,
            l
          );
          break;
        case 6:
          hs(n);
          break;
        case 26:
          Ae(n, n.return), r = n.stateNode, n.memoizedState !== null || r === null || Yt || r.parentNode.removeChild(r), xi(
            n,
            l
          );
          break;
        case 22:
          n.memoizedState === null && xi(
            n,
            l
          );
          break;
        case 30:
          Ae(n, n.return), xi(
            n,
            l
          );
          break;
        case 7:
          Ae(n, n.return);
        default:
          xi(
            n,
            l
          );
      }
      t = t.sibling;
    }
  }
  function gn(t, e, n) {
    for (n = (e.subtreeFlags & 8772) !== 0 ? n : n & -2, e = e.child; e !== null; ) {
      var l = e.alternate, r = t, u = e, m = u.flags, b = (n & 1) !== 0;
      switch (u.tag) {
        case 0:
        case 11:
        case 15:
          gn(
            r,
            u,
            n
          ), ds(4, u);
          break;
        case 1:
          if (gn(
            r,
            u,
            n
          ), l = u, r = l.stateNode, typeof r.componentDidMount == "function")
            try {
              r.componentDidMount();
            } catch (Y) {
              Zt(l, l.return, Y);
            }
          if (l = u, r = l.updateQueue, r !== null) {
            var x = l.stateNode;
            try {
              var V = r.shared.hiddenCallbacks;
              if (V !== null)
                for (r.shared.hiddenCallbacks = null, r = 0; r < V.length; r++)
                  Sp(V[r], x);
            } catch (Y) {
              Zt(l, l.return, Y);
            }
          }
          b && m & 64 && Ng(u), zn(u, u.return);
          break;
        case 27:
          (n & 2) !== 0 && Ug(u);
        case 5:
          u.tag !== 5 && u.tag !== 27 || Vg(u), gn(
            r,
            u,
            n
          ), b && l === null && m & 4 && Jc(u), zn(u, u.return);
          break;
        case 6:
          Vg(u);
          break;
        case 26:
          x = u.stateNode, u.memoizedState !== null || x === null || ye || Kf(
            As(x.ownerDocument),
            u.type,
            x
          ), gn(
            r,
            u,
            n
          ), b && l === null && m & 4 && Jc(u), zn(u, u.return);
          break;
        case 12:
          gn(
            r,
            u,
            n
          );
          break;
        case 31:
          gn(
            r,
            u,
            n
          ), b && m & 4 && Pg(r, u);
          break;
        case 13:
          gn(
            r,
            u,
            n
          ), b && m & 4 && Jg(r, u);
          break;
        case 22:
          u.memoizedState === null && gn(
            r,
            u,
            n
          ), zn(u, u.return);
          break;
        case 30:
          gn(
            r,
            u,
            n
          ), zn(u, u.return);
          break;
        case 7:
          zn(u, u.return);
        default:
          gn(
            r,
            u,
            n
          );
      }
      e = e.sibling;
    }
  }
  function uf(t, e) {
    var n = null;
    t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (n = t.memoizedState.cachePool.pool), t = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (t = e.memoizedState.cachePool.pool), t !== n && (t != null && t.refCount++, n != null && $l(n));
  }
  function cf(t, e) {
    t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && $l(t));
  }
  function un(t, e, n, l) {
    var r = (n & 335544064) === n;
    if (e.subtreeFlags & (r ? 10262 : 10256))
      for (e = e.child; e !== null; )
        $g(
          t,
          e,
          n,
          l
        ), e = e.sibling;
    else r && Yg(e);
  }
  function $g(t, e, n, l) {
    var r = (n & 335544064) === n;
    r && e.alternate === null && e.return !== null && e.return.alternate !== null && ir(e);
    var u = e.flags;
    switch (e.tag) {
      case 0:
      case 11:
      case 15:
        un(
          t,
          e,
          n,
          l
        ), u & 2048 && ds(9, e);
        break;
      case 1:
        un(
          t,
          e,
          n,
          l
        );
        break;
      case 3:
        un(
          t,
          e,
          n,
          l
        ), r && sf && (t = t.containerInfo, t = t.nodeType === 9 ? t.body : t.nodeName === "HTML" ? t.ownerDocument.body : t, t.style.viewTransitionName === "root" && (t.style.viewTransitionName = ""), t = t.ownerDocument.documentElement, t !== null && t.style.viewTransitionName === "none" && (t.style.viewTransitionName = "")), u & 2048 && (u = null, e.alternate !== null && (u = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== u && (e.refCount++, u != null && $l(u)));
        break;
      case 12:
        if (u & 2048) {
          un(
            t,
            e,
            n,
            l
          ), u = e.stateNode;
          try {
            var m = e.memoizedProps, b = m.id, x = m.onPostCommit;
            typeof x == "function" && x(
              b,
              e.alternate === null ? "mount" : "update",
              u.passiveEffectDuration,
              -0
            );
          } catch (V) {
            Zt(e, e.return, V);
          }
        } else
          un(
            t,
            e,
            n,
            l
          );
        break;
      case 31:
        un(
          t,
          e,
          n,
          l
        );
        break;
      case 13:
        un(
          t,
          e,
          n,
          l
        );
        break;
      case 23:
        break;
      case 22:
        m = e.stateNode, b = e.alternate, e.memoizedState !== null ? (r && b !== null && b.memoizedState === null && ir(b), m._visibility & 2 ? un(
          t,
          e,
          n,
          l
        ) : ps(
          t,
          e
        )) : (r && b !== null && b.memoizedState !== null && ir(e), m._visibility & 2 ? un(
          t,
          e,
          n,
          l
        ) : (m._visibility |= 2, tl(
          t,
          e,
          n,
          l,
          (e.subtreeFlags & 10256) !== 0 || !1
        ))), u & 2048 && uf(b, e);
        break;
      case 24:
        un(
          t,
          e,
          n,
          l
        ), u & 2048 && cf(e.alternate, e);
        break;
      case 30:
        r && (u = e.alternate, u !== null && (Nn(u.child, !0), Nn(e.child, !0))), un(
          t,
          e,
          n,
          l
        );
        break;
      default:
        un(
          t,
          e,
          n,
          l
        );
    }
  }
  function tl(t, e, n, l, r) {
    for (r = r && ((e.subtreeFlags & 10256) !== 0 || !1), e = e.child; e !== null; ) {
      var u = t, m = e, b = n, x = l, V = m.flags;
      switch (m.tag) {
        case 0:
        case 11:
        case 15:
          tl(
            u,
            m,
            b,
            x,
            r
          ), ds(8, m);
          break;
        case 23:
          break;
        case 22:
          var Y = m.stateNode;
          m.memoizedState !== null ? Y._visibility & 2 ? tl(
            u,
            m,
            b,
            x,
            r
          ) : ps(
            u,
            m
          ) : (Y._visibility |= 2, tl(
            u,
            m,
            b,
            x,
            r
          )), r && V & 2048 && uf(
            m.alternate,
            m
          );
          break;
        case 24:
          tl(
            u,
            m,
            b,
            x,
            r
          ), r && V & 2048 && cf(m.alternate, m);
          break;
        default:
          tl(
            u,
            m,
            b,
            x,
            r
          );
      }
      e = e.sibling;
    }
  }
  function ps(t, e) {
    if (e.subtreeFlags & 10256)
      for (e = e.child; e !== null; ) {
        var n = t, l = e, r = l.flags;
        switch (l.tag) {
          case 22:
            ps(n, l), r & 2048 && uf(
              l.alternate,
              l
            );
            break;
          case 24:
            ps(n, l), r & 2048 && cf(l.alternate, l);
            break;
          default:
            ps(n, l);
        }
        e = e.sibling;
      }
  }
  var ca = 8192;
  function fa(t, e, n) {
    if (t.subtreeFlags & ca)
      for (t = t.child; t !== null; )
        ty(
          t,
          e,
          n
        ), t = t.sibling;
  }
  function ty(t, e, n) {
    switch (t.tag) {
      case 26:
        fa(
          t,
          e,
          n
        ), t.flags & ca && (t.memoizedState !== null ? vA(
          n,
          pn,
          t.memoizedState,
          t.memoizedProps
        ) : (t = t.stateNode, (e & 335544128) === e && o0(n, t)));
        break;
      case 5:
        fa(
          t,
          e,
          n
        ), t.flags & ca && (t = t.stateNode, (e & 335544128) === e && o0(n, t));
        break;
      case 3:
      case 4:
        var l = pn;
        pn = As(t.stateNode.containerInfo), fa(
          t,
          e,
          n
        ), pn = l;
        break;
      case 22:
        t.memoizedState === null && (l = t.alternate, l !== null && l.memoizedState !== null ? (l = ca, ca = 16777216, fa(
          t,
          e,
          n
        ), ca = l) : fa(
          t,
          e,
          n
        ));
        break;
      case 30:
        if ((t.flags & ca) !== 0 && (l = t.memoizedProps.name, l != null && l !== "auto")) {
          var r = t.stateNode;
          r.paired = null, Pe === null && (Pe = /* @__PURE__ */ new Map()), Pe.set(l, r);
        }
        fa(
          t,
          e,
          n
        );
        break;
      default:
        fa(
          t,
          e,
          n
        );
    }
  }
  function ey(t) {
    var e = t.alternate;
    if (e !== null && (t = e.child, t !== null)) {
      e.child = null;
      do
        e = t.sibling, t.sibling = null, t = e;
      while (t !== null);
    }
  }
  function gs(t) {
    var e = t.deletions;
    if ((t.flags & 16) !== 0) {
      if (e !== null)
        for (var n = 0; n < e.length; n++) {
          var l = e[n];
          ve = l, iy(
            l,
            t
          );
        }
      ey(t);
    }
    if (t.subtreeFlags & 10256)
      for (t = t.child; t !== null; )
        ny(t), t = t.sibling;
  }
  function ny(t) {
    switch (t.tag) {
      case 0:
      case 11:
      case 15:
        gs(t), t.flags & 2048 && Ai(9, t, t.return);
        break;
      case 3:
        gs(t);
        break;
      case 12:
        gs(t);
        break;
      case 22:
        var e = t.stateNode;
        t.memoizedState !== null && e._visibility & 2 && (t.return === null || t.return.tag !== 13) ? (e._visibility &= -3, or(t)) : gs(t);
        break;
      default:
        gs(t);
    }
  }
  function or(t) {
    var e = t.deletions;
    if ((t.flags & 16) !== 0) {
      if (e !== null)
        for (var n = 0; n < e.length; n++) {
          var l = e[n];
          ve = l, iy(
            l,
            t
          );
        }
      ey(t);
    }
    for (t = t.child; t !== null; ) {
      switch (e = t, e.tag) {
        case 0:
        case 11:
        case 15:
          Ai(8, e, e.return), or(e);
          break;
        case 22:
          n = e.stateNode, n._visibility & 2 && (n._visibility &= -3, or(e));
          break;
        default:
          or(e);
      }
      t = t.sibling;
    }
  }
  function iy(t, e) {
    for (; ve !== null; ) {
      var n = ve;
      switch (n.tag) {
        case 0:
        case 11:
        case 15:
          Ai(8, n, e);
          break;
        case 23:
        case 22:
          if (n.memoizedState !== null && n.memoizedState.cachePool !== null) {
            var l = n.memoizedState.cachePool.pool;
            l != null && l.refCount++;
          }
          break;
        case 24:
          $l(n.memoizedState.cache);
      }
      if (l = n.child, l !== null) l.return = n, ve = l;
      else
        t: for (n = t; ve !== null; ) {
          l = ve;
          var r = l.sibling, u = l.return;
          if (Kg(l), l === n) {
            ve = null;
            break t;
          }
          if (r !== null) {
            r.return = u, ve = r;
            break t;
          }
          ve = u;
        }
    }
  }
  var hE = {
    getCacheForType: function(t) {
      var e = Se(se), n = e.data.get(t);
      return n === void 0 && (n = t(), e.data.set(t, n)), n;
    },
    cacheSignal: function() {
      return Se(se).controller.signal;
    }
  }, mE = typeof WeakMap == "function" ? WeakMap : Map, jt = 0, Pt = null, Rt = null, _t = 0, Qt = 0, Je = null, Mi = !1, el = !1, ff = !1, ei = 0, ne = 0, wi = 0, da = 0, rr = 0, Fe = 0, nl = 0, ys = null, je = null, df = !1, ur = 0, ay = 0, cr = 1 / 0, fr = null, Ci = null, $t = 0, yn = null, ha = null, Un = 0, hf = 0, mf = null, ly = null, il = null, al = null, ll = null, vs = 0, dr = null;
  function Ie() {
    return (jt & 2) !== 0 && _t !== 0 ? _t & -_t : P.T !== null ? xf() : rm();
  }
  function sy() {
    if (Fe === 0)
      if ((_t & 536870912) === 0 || Dt) {
        var t = lo;
        lo <<= 1, (lo & 3932160) === 0 && (lo = 262144), Fe = t;
      } else Fe = 536870912;
    return t = Te.current, t !== null && (t.flags |= 32), Fe;
  }
  function sl(t, e) {
    if (e != null) {
      var n = t.stateNode, l = n.ref;
      l === null && (l = n.ref = Gy(
        Zn(t.memoizedProps, n)
      )), al === null && (al = []), al.push(e.bind(null, l));
    }
  }
  function Ge(t, e, n) {
    (t === Pt && (Qt === 2 || Qt === 9) || t.cancelPendingCommit !== null) && (ol(t, 0), Di(
      t,
      _t,
      Fe,
      !1
    )), jl(t, n), ((jt & 2) === 0 || t !== Pt) && (t === Pt && ((jt & 2) === 0 && (da |= n), ne === 4 && Di(
      t,
      _t,
      Fe,
      !1
    )), Bn(t));
  }
  function oy(t, e, n) {
    if ((jt & 6) !== 0) throw Error(o(327));
    var l = !n && (e & 127) === 0 && (e & t.expiredLanes) === 0 || Hl(t, e), r = l ? yE(t, e) : gf(t, e, !0), u = l;
    do {
      if (r === 0) {
        el && !l && Di(t, e, 0, !1);
        break;
      } else {
        if (n = t.current.alternate, u && !pE(n)) {
          r = gf(t, e, !1), u = !1;
          continue;
        }
        if (r === 2) {
          if (u = e, t.errorRecoveryDisabledLanes & u)
            var m = 0;
          else
            m = t.pendingLanes & -536870913, m = m !== 0 ? m : m & 536870912 ? 536870912 : 0;
          if (m !== 0) {
            e = m;
            t: {
              var b = t;
              r = ys;
              var x = b.current.memoizedState.isDehydrated;
              if (x && (ol(b, m).flags |= 256), m = gf(
                b,
                m,
                !1
              ), m !== 2 && m !== 6) {
                if (ff && !x) {
                  b.errorRecoveryDisabledLanes |= u, da |= u, r = 4;
                  break t;
                }
                u = je, je = r, u !== null && (je === null ? je = u : je.push.apply(
                  je,
                  u
                ));
              }
              r = m;
            }
            if (u = !1, r !== 2) continue;
          }
        }
        if (r === 1) {
          ol(t, 0), Di(t, e, 0, !0);
          break;
        }
        t: {
          switch (l = t, u = r, u) {
            case 0:
            case 1:
              throw Error(o(345));
            case 4:
              if ((e & 4194048) !== e && (e & 62914560) !== e)
                break;
            case 6:
              Di(
                l,
                e,
                Fe,
                !Mi
              );
              break t;
            case 2:
              je = null;
              break;
            case 3:
            case 5:
              break;
            default:
              throw Error(o(329));
          }
          if ((e & 62914560) === e && (r = ur + 300 - we(), 10 < r)) {
            if (Di(
              l,
              e,
              Fe,
              !Mi
            ), oo(l, 0, !0) !== 0) break t;
            Un = e, l.timeoutHandle = Lf(
              ry.bind(
                null,
                l,
                n,
                je,
                fr,
                df,
                e,
                Fe,
                da,
                nl,
                Mi,
                u,
                "Throttled",
                -0,
                0
              ),
              r
            );
            break t;
          }
          ry(
            l,
            n,
            je,
            fr,
            df,
            e,
            Fe,
            da,
            nl,
            Mi,
            u,
            null,
            -0,
            0
          );
        }
      }
      break;
    } while (!0);
    Bn(t);
  }
  function ry(t, e, n, l, r, u, m, b, x, V, Y, Z, R, j) {
    t.timeoutHandle = -1;
    var ot = e.subtreeFlags, yt = (u & 335544064) === u;
    if (Z = null, (yt || ot & 8192 || (ot & 16785408) === 16785408) && (Z = {
      stylesheets: null,
      count: 0,
      imgCount: 0,
      imgBytes: 0,
      suspenseyImages: [],
      waitingForImages: !0,
      waitingForViewTransition: !1,
      unsuspend: Cn
    }, Pe = null, ty(
      e,
      u,
      Z
    ), yt && (ot = Z, yt = t.containerInfo, yt = (yt.nodeType === 9 ? yt : yt.ownerDocument).__reactViewTransition, yt != null && (ot.count++, ot.waitingForViewTransition = !0, ot = ws.bind(ot), yt.finished.then(ot, ot))), ot = (u & 62914560) === u ? ur - we() : (u & 4194048) === u ? ay - we() : 0, ot = bA(
      Z,
      ot
    ), ot !== null)) {
      Un = u, t.cancelPendingCommit = ot(
        gy.bind(
          null,
          t,
          e,
          u,
          n,
          l,
          r,
          m,
          b,
          x,
          V,
          Y,
          Z,
          null,
          R,
          j
        )
      ), Di(t, u, m, !V);
      return;
    }
    gy(
      t,
      e,
      u,
      n,
      l,
      r,
      m,
      b,
      x,
      V,
      Y,
      Z
    );
  }
  function pE(t) {
    for (var e = t; ; ) {
      var n = e.tag;
      if ((n === 0 || n === 11 || n === 15) && e.flags & 16384 && (n = e.updateQueue, n !== null && (n = n.stores, n !== null)))
        for (var l = 0; l < n.length; l++) {
          var r = n[l], u = r.getSnapshot;
          r = r.value;
          try {
            if (!Ke(u(), r)) return !1;
          } catch {
            return !1;
          }
        }
      if (n = e.child, e.subtreeFlags & 16384 && n !== null)
        n.return = e, e = n;
      else {
        if (e === t) break;
        for (; e.sibling === null; ) {
          if (e.return === null || e.return === t) return !0;
          e = e.return;
        }
        e.sibling.return = e.return, e = e.sibling;
      }
    }
    return !0;
  }
  function Di(t, e, n, l) {
    e = im(t, e), e &= ~rr, e &= ~da, t.suspendedLanes |= e, t.pingedLanes &= ~e, l && (t.warmLanes |= e), l = t.expirationTimes;
    for (var r = e; 0 < r; ) {
      var u = 31 - Qe(r), m = 1 << u;
      l[u] = -1, r &= ~m;
    }
    n !== 0 && lm(t, n, e);
  }
  function hr() {
    return (jt & 6) === 0 ? (bs(0), !1) : !0;
  }
  function pf() {
    if (Rt !== null) {
      if (Qt === 0)
        var t = Rt.return;
      else
        t = Rt, Jn = ta = null, Ec(t), ka = null, ns = 0, t = Rt;
      for (; t !== null; )
        Rg(t.alternate, t), t = t.return;
      Rt = null;
    }
  }
  function ol(t, e) {
    var n = t.timeoutHandle;
    return n !== -1 && (t.timeoutHandle = -1, jE(n)), n = t.cancelPendingCommit, n !== null && (t.cancelPendingCommit = null, n()), Un = 0, pf(), Pt = t, Rt = n = kn(t.current, null), _t = e, Qt = 0, Je = null, Mi = !1, el = Hl(t, e), ff = !1, nl = Fe = rr = da = wi = ne = 0, je = ys = null, df = !1, ei = im(t, e), To(), n;
  }
  function uy(t, e) {
    wt = null, P.H = Ko, e === Ka || e === No ? (e = gp(), Qt = 3) : e === uc ? (e = gp(), Qt = 4) : Qt = e === Bc ? 8 : e !== null && typeof e == "object" && typeof e.then == "function" ? 6 : 1, Je = e, Rt === null && (ne = 1, ko(
      t,
      ln(e, t.current)
    ));
  }
  function cy() {
    var t = Te.current;
    return t === null ? !0 : (_t & 4194048) === _t ? Ce === null : (_t & 62914560) === _t || (_t & 536870912) !== 0 ? t === Ce : !1;
  }
  function fy() {
    var t = P.H;
    return P.H = Ko, t === null ? Ko : t;
  }
  function dy() {
    var t = P.A;
    return P.A = hE, t;
  }
  function mr() {
    ne = 4, Mi || (_t & 4194048) !== _t && Te.current !== null || (el = !0), (wi & 134217727) === 0 && (da & 134217727) === 0 || Pt === null || Di(
      Pt,
      _t,
      Fe,
      !1
    );
  }
  function gf(t, e, n) {
    var l = jt;
    jt |= 2;
    var r = fy(), u = dy();
    (Pt !== t || _t !== e) && (fr = null, ol(t, e)), e = !1;
    var m = ne;
    t: do
      try {
        if (Qt !== 0 && Rt !== null) {
          var b = Rt, x = Je;
          switch (Qt) {
            case 8:
              pf(), m = 6;
              break t;
            case 3:
            case 2:
            case 9:
            case 6:
              Te.current === null && (e = !0);
              var V = Qt;
              if (Qt = 0, Je = null, rl(t, b, x, V), n && el) {
                m = 0;
                break t;
              }
              break;
            default:
              V = Qt, Qt = 0, Je = null, rl(t, b, x, V);
          }
        }
        gE(), m = ne;
        break;
      } catch (Y) {
        uy(t, Y);
      }
    while (!0);
    return e && t.shellSuspendCounter++, Jn = ta = null, jt = l, P.H = r, P.A = u, Rt === null && (Pt = null, _t = 0, To()), m;
  }
  function gE() {
    for (; Rt !== null; ) hy(Rt);
  }
  function yE(t, e) {
    var n = jt;
    jt |= 2;
    var l = fy(), r = dy();
    Pt !== t || _t !== e ? (fr = null, cr = we() + 500, ol(t, e)) : el = Hl(
      t,
      e
    );
    t: do
      try {
        if (Qt !== 0 && Rt !== null) {
          e = Rt;
          var u = Je;
          e: switch (Qt) {
            case 1:
              Qt = 0, Je = null, rl(t, e, u, 1);
              break;
            case 2:
            case 9:
              if (mp(u)) {
                Qt = 0, Je = null, my(e);
                break;
              }
              e = function() {
                Qt !== 2 && Qt !== 9 || Pt !== t || (Qt = 7), Bn(t);
              }, u.then(e, e);
              break t;
            case 3:
              Qt = 7;
              break t;
            case 4:
              Qt = 5;
              break t;
            case 7:
              mp(u) ? (Qt = 0, Je = null, my(e)) : (Qt = 0, Je = null, rl(t, e, u, 7));
              break;
            case 5:
              var m = null;
              switch (Rt.tag) {
                case 26:
                  m = Rt.memoizedState;
                case 5:
                case 27:
                  var b = Rt;
                  if (m ? l0(m) : b.stateNode.complete) {
                    Qt = 0, Je = null;
                    var x = b.sibling;
                    if (x !== null) Rt = x;
                    else {
                      var V = b.return;
                      V !== null ? (Rt = V, pr(V)) : Rt = null;
                    }
                    break e;
                  }
              }
              Qt = 0, Je = null, rl(t, e, u, 5);
              break;
            case 6:
              Qt = 0, Je = null, rl(t, e, u, 6);
              break;
            case 8:
              pf(), ne = 6;
              break t;
            default:
              throw Error(o(462));
          }
        }
        vE();
        break;
      } catch (Y) {
        uy(t, Y);
      }
    while (!0);
    return Jn = ta = null, P.H = l, P.A = r, jt = n, Rt !== null ? 0 : (Pt = null, _t = 0, To(), ne);
  }
  function vE() {
    for (; Rt !== null && !Su(); )
      hy(Rt);
  }
  function hy(t) {
    var e = Og(t.alternate, t, ei);
    t.memoizedProps = t.pendingProps, e === null ? pr(t) : Rt = e;
  }
  function my(t) {
    var e = t, n = e.alternate;
    switch (e.tag) {
      case 15:
      case 0:
        e = Eg(
          n,
          e,
          e.pendingProps,
          e.type,
          void 0,
          _t
        );
        break;
      case 11:
        e = Eg(
          n,
          e,
          e.pendingProps,
          e.type.render,
          e.ref,
          _t
        );
        break;
      case 5:
        Ec(e);
        var l = e;
        l === ge && (Dt ? (Co(l), l.tag === 5 && l.stateNode != null && (Ft = l.stateNode)) : (Co(l), Dt = !0));
      default:
        Rg(n, e), e = Rt = ip(e, ei), e = Og(n, e, ei);
    }
    t.memoizedProps = t.pendingProps, e === null ? pr(t) : Rt = e;
  }
  function rl(t, e, n, l) {
    Jn = ta = null, Ec(e), ka = null, ns = 0;
    var r = e.return;
    try {
      if (lE(
        t,
        r,
        e,
        n,
        _t
      )) {
        ne = 1, ko(
          t,
          ln(n, t.current)
        ), Rt = null;
        return;
      }
    } catch (u) {
      if (r !== null) throw Rt = r, u;
      ne = 1, ko(
        t,
        ln(n, t.current)
      ), Rt = null;
      return;
    }
    e.flags & 32768 ? (Dt || l === 1 ? t = !0 : el || (_t & 536870912) !== 0 ? t = !1 : (Mi = t = !0, (l === 2 || l === 9 || l === 3 || l === 6) && (l = Te.current, l !== null && l.tag === 13 && (l.flags |= 16384))), py(e, t)) : pr(e);
  }
  function pr(t) {
    var e = t;
    do {
      if ((e.flags & 32768) !== 0) {
        py(
          e,
          Mi
        );
        return;
      }
      t = e.return;
      var n = uE(
        e.alternate,
        e,
        ei
      );
      if (n !== null) {
        Rt = n;
        return;
      }
      if (e = e.sibling, e !== null) {
        Rt = e;
        return;
      }
      Rt = e = t;
    } while (e !== null);
    ne === 0 && (ne = 5);
  }
  function py(t, e) {
    do {
      var n = cE(t.alternate, t);
      if (n !== null) {
        n.flags &= 32767, Rt = n;
        return;
      }
      if (n = t.return, n !== null && (n.flags |= 32768, n.subtreeFlags = 0, n.deletions = null), !e && (t = t.sibling, t !== null)) {
        Rt = t;
        return;
      }
      Rt = t = n;
    } while (t !== null);
    ne = 6, Rt = null;
  }
  function gy(t, e, n, l, r, u, m, b, x, V, Y, Z) {
    t.cancelPendingCommit = null;
    do
      gr();
    while ($t !== 0);
    if ((jt & 6) !== 0) throw Error(o(327));
    if (e !== null) {
      if (e === t.current) throw Error(o(177));
      t === Pt && (Rt = Pt = null, _t = 0), ha = e, yn = t, Un = n, mf = r, ly = l, bE(
        t,
        e,
        n,
        m,
        b,
        x,
        Z
      );
    }
  }
  function bE(t, e, n, l, r, u, m) {
    var b = e.lanes | e.childLanes;
    if (hf = b, b |= Fu, ZS(
      t,
      n,
      b,
      l,
      r,
      u
    ), al = null, (n & 335544064) === n ? (ll = kT(t), l = 10262) : (ll = null, l = 10256), (e.subtreeFlags & l) !== 0 || (e.flags & l) !== 0 ? (t.callbackNode = null, t.callbackPriority = 0, ME(Zi, function() {
      return Sf(), null;
    })) : (t.callbackNode = null, t.callbackPriority = 0), er = !1, l = (e.flags & 13878) !== 0, (e.subtreeFlags & 13878) !== 0 || l) {
      l = P.T, P.T = null, r = G.p, G.p = 2, u = jt, jt |= 4;
      try {
        fE(t, e, n);
      } finally {
        jt = u, G.p = r, P.T = l;
      }
    }
    $t = 1, er ? il = ZE(
      m,
      t.containerInfo,
      ll,
      yf,
      vf,
      TE,
      bf,
      Sf,
      SE
    ) : (yf(), vf(), bf());
  }
  function SE(t) {
    if ($t !== 0) {
      var e = yn.onRecoverableError;
      e(t, { componentStack: null });
    }
  }
  function TE() {
    $t === 3 && ($t = 0, Wg(ha, yn), $t = 4);
  }
  function yf() {
    if ($t === 1) {
      $t = 0;
      var t = yn, e = ha, n = Un, l = (e.flags & 13878) !== 0;
      if ((e.subtreeFlags & 13878) !== 0 || l) {
        l = P.T, P.T = null;
        var r = G.p;
        G.p = 2;
        var u = jt;
        jt |= 4;
        try {
          ms = ar = !1, Fg(e, t, n), n = Nf;
          var m = km(t.containerInfo), b = n.focusedElem, x = n.selectionRange;
          if (m !== b && b && b.ownerDocument && Km(
            b.ownerDocument.documentElement,
            b
          )) {
            if (x !== null && Zu(b)) {
              var V = x.start, Y = x.end;
              if (Y === void 0 && (Y = V), "selectionStart" in b)
                b.selectionStart = V, b.selectionEnd = Math.min(
                  Y,
                  b.value.length
                );
              else {
                var Z = b.ownerDocument || document, R = Z && Z.defaultView || window;
                if (R.getSelection) {
                  var j = R.getSelection(), ot = b.textContent.length, yt = Math.min(x.start, ot), Ct = x.end === void 0 ? yt : Math.min(x.end, ot);
                  !j.extend && yt > Ct && (m = Ct, Ct = yt, yt = m);
                  var _ = Zm(
                    b,
                    yt
                  ), O = Zm(
                    b,
                    Ct
                  );
                  if (_ && O && (j.rangeCount !== 1 || j.anchorNode !== _.node || j.anchorOffset !== _.offset || j.focusNode !== O.node || j.focusOffset !== O.offset)) {
                    var B = Z.createRange();
                    B.setStart(_.node, _.offset), j.removeAllRanges(), yt > Ct ? (j.addRange(B), j.extend(O.node, O.offset)) : (B.setEnd(O.node, O.offset), j.addRange(B));
                  }
                }
              }
            }
            for (Z = [], j = b; j = j.parentNode; )
              j.nodeType === 1 && Z.push({
                element: j,
                left: j.scrollLeft,
                top: j.scrollTop
              });
            for (typeof b.focus == "function" && b.focus(), b = 0; b < Z.length; b++) {
              var Q = Z[b];
              Q.element.scrollLeft = Q.left, Q.element.scrollTop = Q.top;
            }
          }
          gl = !!Rf, Nf = Rf = null;
        } finally {
          jt = u, G.p = r, P.T = l;
        }
      }
      t.current = e, $t = 2;
    }
  }
  function vf() {
    if ($t === 2) {
      $t = 0;
      var t = yn, e = ha, n = (e.flags & 8772) !== 0;
      if ((e.subtreeFlags & 8772) !== 0 || n) {
        n = P.T, P.T = null;
        var l = G.p;
        G.p = 2;
        var r = jt;
        jt |= 4;
        try {
          Qg(t, e.alternate, e);
        } finally {
          jt = r, G.p = l, P.T = n;
        }
      }
      $t = 3;
    }
  }
  function bf() {
    if ($t === 4 || $t === 3) {
      $t = 0;
      var t = il;
      il = null, Tu();
      var e = yn, n = ha, l = Un, r = ly, u = (l & 335544064) === l ? 10262 : 10256;
      if ((n.subtreeFlags & u) !== 0 || (n.flags & u) !== 0 ? $t = 5 : ($t = 0, ha = yn = null, yy(e, e.pendingLanes)), u = e.pendingLanes, u === 0 && (Ci = null), Cu(l), n = n.stateNode, Xe && typeof Xe.onCommitFiberRoot == "function")
        try {
          Xe.onCommitFiberRoot(
            Bl,
            n,
            void 0,
            (n.current.flags & 128) === 128
          );
        } catch {
        }
      if (r !== null) {
        n = P.T, u = G.p, G.p = 2, P.T = null;
        try {
          for (var m = e.onRecoverableError, b = 0; b < r.length; b++) {
            var x = r[b];
            m(x.value, {
              componentStack: x.stack
            });
          }
        } finally {
          P.T = n, G.p = u;
        }
      }
      if (r = al, m = ll, ll = null, r !== null && (al = null, m === null && (m = []), t !== null))
        for (x = 0; x < r.length; x++)
          n = (0, r[x])(
            m
          ), n !== void 0 && t.finished.finally(n);
      (Un & 3) !== 0 && gr(), Bn(e), u = e.pendingLanes, (l & 261930) !== 0 && (u & 42) !== 0 ? e === dr ? vs++ : (vs = 0, dr = e) : (vs = 0, dr = null), bs(0);
    }
  }
  function yy(t, e) {
    (t.pooledCacheLanes &= e) === 0 && (e = t.pooledCache, e != null && (t.pooledCache = null, $l(e)));
  }
  function gr() {
    return il !== null && (il.skipTransition(), il = null), yf(), vf(), bf(), Sf();
  }
  function Sf() {
    if ($t !== 5) return !1;
    var t = yn, e = hf;
    hf = 0;
    var n = Cu(Un), l = P.T, r = G.p;
    try {
      G.p = 32 > n ? 32 : n, P.T = null, n = mf, mf = null;
      var u = yn, m = Un;
      if ($t = 0, ha = yn = null, Un = 0, (jt & 6) !== 0) throw Error(o(331));
      var b = jt;
      if (jt |= 4, ny(u.current), $g(
        u,
        u.current,
        m,
        n
      ), jt = b, bs(0, !1), Xe && typeof Xe.onPostCommitFiberRoot == "function")
        try {
          Xe.onPostCommitFiberRoot(Bl, u);
        } catch {
        }
      return !0;
    } finally {
      G.p = r, P.T = l, yy(t, e);
    }
  }
  function vy(t, e, n) {
    e = ln(n, e), e = Uc(t.stateNode, e, 2), t = bi(t, e, 2), t !== null && (jl(t, 2), Bn(t));
  }
  function Zt(t, e, n) {
    if (t.tag === 3)
      vy(t, t, n);
    else
      for (; e !== null; ) {
        if (e.tag === 3) {
          vy(
            e,
            t,
            n
          );
          break;
        } else if (e.tag === 1) {
          var l = e.stateNode;
          if (typeof e.type.getDerivedStateFromError == "function" || typeof l.componentDidCatch == "function" && (Ci === null || !Ci.has(l))) {
            t = ln(n, t), n = mg(2), l = bi(e, n, 2), l !== null && (pg(
              n,
              l,
              e,
              t
            ), jl(l, 2), Bn(l));
            break;
          }
        }
        e = e.return;
      }
  }
  function Tf(t, e, n) {
    var l = t.pingCache;
    if (l === null) {
      l = t.pingCache = new mE();
      var r = /* @__PURE__ */ new Set();
      l.set(e, r);
    } else
      r = l.get(e), r === void 0 && (r = /* @__PURE__ */ new Set(), l.set(e, r));
    r.has(n) || (ff = !0, r.add(n), t = EE.bind(null, t, e, n), e.then(t, t));
  }
  function EE(t, e, n) {
    var l = t.pingCache;
    l !== null && l.delete(e), t.pingedLanes |= t.suspendedLanes & n, t.warmLanes &= ~n, Pt === t && (_t & n) === n && ((ne === 4 || ne === 3 && (_t & 62914560) === _t && 300 > we() - ur) && (jt & 2) === 0 ? ol(t, 0) : rr |= n, nl === _t && (nl = 0)), Bn(t);
  }
  function by(t, e) {
    e === 0 && (e = am()), t = Ii(t, e), t !== null && (jl(t, e), Bn(t));
  }
  function AE(t) {
    var e = t.memoizedState, n = 0;
    e !== null && (n = e.retryLane), by(t, n);
  }
  function xE(t, e) {
    var n = 0;
    switch (t.tag) {
      case 31:
      case 13:
        var l = t.stateNode, r = t.memoizedState;
        r !== null && (n = r.retryLane);
        break;
      case 19:
        l = t.stateNode;
        break;
      case 22:
        l = t.stateNode._retryCache;
        break;
      default:
        throw Error(o(314));
    }
    l !== null && l.delete(e), by(t, n);
  }
  function ME(t, e) {
    return Nl(t, e);
  }
  var ul = null, cl = null, Ef = !1, yr = !1, Af = !1, Oi = 0;
  function Bn(t) {
    t !== cl && t.next === null && (cl === null ? ul = cl = t : cl = cl.next = t), yr = !0, Ef || (Ef = !0, CE());
  }
  function bs(t, e) {
    if (!Af && yr) {
      Af = !0;
      do
        for (var n = !1, l = ul; l !== null; ) {
          if (t !== 0) {
            var r = l.pendingLanes;
            if (r === 0) var u = 0;
            else {
              var m = l.suspendedLanes, b = l.pingedLanes;
              u = (1 << 31 - Qe(42 | t) + 1) - 1, u &= r & ~(m & ~b), u = u & 201326741 ? u & 201326741 | 1 : u ? u | 2 : 0;
            }
            u !== 0 && (n = !0, Ay(l, u));
          } else
            u = _t, u = oo(
              l,
              l === Pt ? u : 0,
              l.cancelPendingCommit !== null || l.timeoutHandle !== -1
            ), (u & 3) === 0 || Hl(l, u) || (n = !0, Ay(l, u));
          l = l.next;
        }
      while (n);
      Af = !1;
    }
  }
  function wE() {
    Sy();
  }
  function Sy() {
    yr = Ef = !1;
    var t = 0;
    Oi !== 0 && HE() && (t = Oi);
    for (var e = we(), n = null, l = ul; l !== null; ) {
      var r = l.next, u = Ty(l, e);
      u === 0 ? (l.next = null, n === null ? ul = r : n.next = r, r === null && (cl = n)) : (n = l, (t !== 0 || (u & 3) !== 0) && (yr = !0)), l = r;
    }
    $t !== 0 && $t !== 5 || bs(t), Oi !== 0 && (Oi = 0);
  }
  function Ty(t, e) {
    for (var n = t.suspendedLanes, l = t.pingedLanes, r = t.expirationTimes, u = t.pendingLanes & -62914561; 0 < u; ) {
      var m = 31 - Qe(u), b = 1 << m, x = r[m];
      x === -1 ? ((b & n) === 0 || (b & l) !== 0) && (r[m] = QS(b, e)) : x <= e && (t.expiredLanes |= b), u &= ~b;
    }
    if (e = Pt, n = _t, n = oo(
      t,
      t === e ? n : 0,
      t.cancelPendingCommit !== null || t.timeoutHandle !== -1
    ), l = t.callbackNode, n === 0 || t === e && (Qt === 2 || Qt === 9) || t.cancelPendingCommit !== null)
      return l !== null && l !== null && _l(l), t.callbackNode = null, t.callbackPriority = 0;
    if ((n & 3) === 0 || Hl(t, n)) {
      if (e = n & -n, e === t.callbackPriority) return e;
      switch (l !== null && _l(l), Cu(n)) {
        case 2:
        case 8:
          n = Ll;
          break;
        case 32:
          n = Zi;
          break;
        case 268435456:
          n = Ul;
          break;
        default:
          n = Zi;
      }
      return l = Ey.bind(null, t), n = Nl(n, l), t.callbackPriority = e, t.callbackNode = n, e;
    }
    return l !== null && l !== null && _l(l), t.callbackPriority = 2, t.callbackNode = null, 2;
  }
  function Ey(t, e) {
    if ($t !== 0 && $t !== 5)
      return t.callbackNode = null, t.callbackPriority = 0, null;
    var n = t.callbackNode;
    if (gr() && t.callbackNode !== n)
      return null;
    var l = _t;
    return l = oo(
      t,
      t === Pt ? l : 0,
      t.cancelPendingCommit !== null || t.timeoutHandle !== -1
    ), l === 0 ? null : (oy(t, l, e), Ty(t, we()), t.callbackNode != null && t.callbackNode === n ? Ey.bind(null, t) : null);
  }
  function Ay(t, e) {
    if (gr()) return null;
    oy(t, e, !0);
  }
  function CE() {
    GE(function() {
      (jt & 6) !== 0 ? Nl(
        Vl,
        wE
      ) : Sy();
    });
  }
  function xf() {
    if (Oi === 0) {
      var t = ia;
      t === 0 && (t = ao, ao <<= 1, (ao & 261888) === 0 && (ao = 256)), Oi = t;
    }
    return Oi;
  }
  function xy(t) {
    return t == null || typeof t == "symbol" || typeof t == "boolean" ? null : typeof t == "function" ? t : ho(t);
  }
  function DE(t, e, n, l, r) {
    if (e === "submit" && n && n.stateNode === r) {
      var u = xy(
        (r[Le] || null).action
      ), m = l.submitter;
      m && (e = (e = m[Le] || null) ? xy(e.formAction) : m.getAttribute("formAction"), e !== null && (u = e, m = null));
      var b = new yo(
        "action",
        "action",
        null,
        l,
        r
      );
      t.push({
        event: b,
        listeners: [
          {
            instance: null,
            listener: function() {
              if (l.defaultPrevented) {
                if (Oi !== 0) {
                  var x = new FormData(r, m);
                  Rc(
                    n,
                    {
                      pending: !0,
                      data: x,
                      method: r.method,
                      action: u
                    },
                    null,
                    x
                  );
                }
              } else
                typeof u == "function" && (b.preventDefault(), x = new FormData(r, m), Rc(
                  n,
                  {
                    pending: !0,
                    data: x,
                    method: r.method,
                    action: u
                  },
                  u,
                  x
                ));
            },
            currentTarget: r
          }
        ]
      });
    }
  }
  for (var Mf = 0; Mf < Ju.length; Mf++) {
    var wf = Ju[Mf], OE = wf.toLowerCase(), zE = wf[0].toUpperCase() + wf.slice(1);
    hn(
      OE,
      "on" + zE
    );
  }
  hn(Fm, "onAnimationEnd"), hn(Im, "onAnimationIteration"), hn(Wm, "onAnimationStart"), hn("dblclick", "onDoubleClick"), hn("focusin", "onFocus"), hn("focusout", "onBlur"), hn(jT, "onTransitionRun"), hn(GT, "onTransitionStart"), hn(YT, "onTransitionCancel"), hn($m, "onTransitionEnd"), Na("onMouseEnter", ["mouseout", "mouseover"]), Na("onMouseLeave", ["mouseout", "mouseover"]), Na("onPointerEnter", ["pointerout", "pointerover"]), Na("onPointerLeave", ["pointerout", "pointerover"]), Pi(
    "onChange",
    "change click focusin focusout input keydown keyup selectionchange".split(" ")
  ), Pi(
    "onSelect",
    "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(
      " "
    )
  ), Pi("onBeforeInput", [
    "compositionend",
    "keypress",
    "textInput",
    "paste"
  ]), Pi(
    "onCompositionEnd",
    "compositionend focusout keydown keypress keyup mousedown".split(" ")
  ), Pi(
    "onCompositionStart",
    "compositionstart focusout keydown keypress keyup mousedown".split(" ")
  ), Pi(
    "onCompositionUpdate",
    "compositionupdate focusout keydown keypress keyup mousedown".split(" ")
  );
  var Ss = "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(
    " "
  ), RE = new Set(
    "beforetoggle cancel close invalid load scroll scrollend toggle".split(" ").concat(Ss)
  );
  function My(t, e) {
    e = (e & 4) !== 0;
    for (var n = 0; n < t.length; n++) {
      var l = t[n], r = l.event;
      l = l.listeners;
      t: {
        var u = void 0;
        if (e)
          for (var m = l.length - 1; 0 <= m; m--) {
            var b = l[m], x = b.instance, V = b.currentTarget;
            if (b = b.listener, x !== u && r.isPropagationStopped())
              break t;
            u = b, r.currentTarget = V;
            try {
              u(r);
            } catch (Y) {
              So(Y);
            }
            r.currentTarget = null, u = x;
          }
        else
          for (m = 0; m < l.length; m++) {
            if (b = l[m], x = b.instance, V = b.currentTarget, b = b.listener, x !== u && r.isPropagationStopped())
              break t;
            u = b, r.currentTarget = V;
            try {
              u(r);
            } catch (Y) {
              So(Y);
            }
            r.currentTarget = null, u = x;
          }
      }
    }
  }
  function Nt(t, e) {
    var n = e[cm];
    n === void 0 && (n = e[cm] = /* @__PURE__ */ new Set());
    var l = t + "__bubble";
    n.has(l) || (wy(e, t, 2, !1), n.add(l));
  }
  function Cf(t, e, n) {
    var l = 0;
    e && (l |= 4), wy(
      n,
      t,
      l,
      e
    );
  }
  var vr = "_reactListening" + Math.random().toString(36).slice(2);
  function Df(t) {
    if (!t[vr]) {
      t[vr] = !0, hm.forEach(function(n) {
        n !== "selectionchange" && (RE.has(n) || Cf(n, !1, t), Cf(n, !0, t));
      });
      var e = t.nodeType === 9 ? t : t.ownerDocument;
      e === null || e[vr] || (e[vr] = !0, Cf("selectionchange", !1, e));
    }
  }
  function wy(t, e, n, l) {
    switch (p0(e)) {
      case 2:
        var r = AA;
        break;
      case 8:
        r = xA;
        break;
      default:
        r = Pf;
    }
    n = r.bind(
      null,
      e,
      n,
      t
    ), r = void 0, !Lu || e !== "touchstart" && e !== "touchmove" && e !== "wheel" || (r = !0), l ? r !== void 0 ? t.addEventListener(e, n, {
      capture: !0,
      passive: r
    }) : t.addEventListener(e, n, !0) : r !== void 0 ? t.addEventListener(e, n, {
      passive: r
    }) : t.addEventListener(e, n, !1);
  }
  function Of(t, e, n, l, r) {
    var u = l;
    if ((e & 1) === 0 && (e & 2) === 0 && l !== null)
      t: for (; ; ) {
        if (l === null) return;
        var m = l.tag;
        if (m === 3 || m === 4) {
          var b = l.stateNode.containerInfo;
          if (b === r) break;
          if (m === 4)
            for (m = l.return; m !== null; ) {
              var x = m.tag;
              if ((x === 3 || x === 4) && m.stateNode.containerInfo === r)
                return;
              m = m.return;
            }
          for (; b !== null; ) {
            if (m = ki(b), m === null) return;
            if (x = m.tag, x === 5 || x === 6 || x === 26 || x === 27) {
              l = u = m;
              continue t;
            }
            b = b.parentNode;
          }
        }
        l = l.return;
      }
    wm(function() {
      var V = u, Y = _u(n), Z = [];
      t: {
        var R = tp.get(t);
        if (R !== void 0) {
          var j = yo, ot = t;
          switch (t) {
            case "keypress":
              if (po(n) === 0) break t;
            case "keydown":
            case "keyup":
              j = pT;
              break;
            case "focusin":
              ot = "focus", j = ju;
              break;
            case "focusout":
              ot = "blur", j = ju;
              break;
            case "beforeblur":
            case "afterblur":
              j = ju;
              break;
            case "click":
              if (n.button === 2) break t;
            case "auxclick":
            case "dblclick":
            case "mousedown":
            case "mousemove":
            case "mouseup":
            case "mouseout":
            case "mouseover":
            case "contextmenu":
              j = Om;
              break;
            case "drag":
            case "dragend":
            case "dragenter":
            case "dragexit":
            case "dragleave":
            case "dragover":
            case "dragstart":
            case "drop":
              j = iT;
              break;
            case "touchcancel":
            case "touchend":
            case "touchmove":
            case "touchstart":
              j = ST;
              break;
            case Fm:
            case Im:
            case Wm:
              j = sT;
              break;
            case $m:
              j = ET;
              break;
            case "scroll":
            case "scrollend":
              j = eT;
              break;
            case "wheel":
              j = xT;
              break;
            case "copy":
            case "cut":
            case "paste":
              j = rT;
              break;
            case "gotpointercapture":
            case "lostpointercapture":
            case "pointercancel":
            case "pointerdown":
            case "pointermove":
            case "pointerout":
            case "pointerover":
            case "pointerup":
              j = Rm;
              break;
            case "submit":
              j = vT;
              break;
            case "toggle":
            case "beforetoggle":
              j = wT;
          }
          var yt = (e & 4) !== 0, Ct = !yt && (t === "scroll" || t === "scrollend"), _ = yt ? R !== null ? R + "Capture" : null : R;
          yt = [];
          for (var O = V, B; O !== null; ) {
            var Q = O;
            if (B = Q.stateNode, Q = Q.tag, Q !== 5 && Q !== 26 && Q !== 27 || B === null || _ === null || (Q = ql(O, _), Q != null && yt.push(
              Ts(O, Q, B)
            )), Ct) break;
            O = O.return;
          }
          0 < yt.length && (R = new j(
            R,
            ot,
            null,
            n,
            Y
          ), Z.push({ event: R, listeners: yt }));
        }
      }
      if ((e & 7) === 0) {
        t: {
          if (j = t === "mouseover" || t === "pointerover", R = t === "mouseout" || t === "pointerout", j && n !== Nu && (ot = n.relatedTarget || n.fromElement) && (ki(ot) || ot[Oa]))
            break t;
          (R || j) && (ot = Y.window === Y ? Y : (j = Y.ownerDocument) ? j.defaultView || j.parentWindow : window, R ? (j = n.relatedTarget || n.toElement, R = V, j = j ? ki(j) : null, j !== null && (Ct = d(j), yt = j.tag, j !== Ct || yt !== 5 && yt !== 27 && yt !== 6) && (j = null)) : (R = null, j = V), R !== j && (yt = Om, Q = "onMouseLeave", _ = "onMouseEnter", O = "mouse", (t === "pointerout" || t === "pointerover") && (yt = Rm, Q = "onPointerLeave", _ = "onPointerEnter", O = "pointer"), Ct = R == null ? ot : Yl(R), B = j == null ? ot : Yl(j), ot = new yt(
            Q,
            O + "leave",
            R,
            n,
            Y
          ), ot.target = Ct, ot.relatedTarget = B, Q = null, ki(Y) === V && (yt = new yt(
            _,
            O + "enter",
            j,
            n,
            Y
          ), yt.target = B, yt.relatedTarget = Ct, Q = yt), Ct = Q, yt = R && j ? et(
            R,
            j,
            NE
          ) : null, R !== null && Cy(
            Z,
            ot,
            R,
            yt,
            !1
          ), j !== null && Ct !== null && Cy(
            Z,
            Ct,
            j,
            yt,
            !0
          )));
        }
        t: {
          if (R = V ? Yl(V) : window, j = R.nodeName && R.nodeName.toLowerCase(), j === "select" || j === "input" && R.type === "file")
            var ht = jm;
          else if (Bm(R))
            if (Gm)
              ht = UT;
            else {
              ht = VT;
              var Vt = _T;
            }
          else
            j = R.nodeName, !j || j.toLowerCase() !== "input" || R.type !== "checkbox" && R.type !== "radio" ? V && Ru(V.elementType) && (ht = jm) : ht = LT;
          if (ht && (ht = ht(t, V))) {
            Hm(
              Z,
              ht,
              n,
              Y
            );
            break t;
          }
          Vt && Vt(t, R, V);
        }
        switch (Vt = V ? Yl(V) : window, t) {
          case "focusin":
            (Bm(Vt) || Vt.contentEditable === "true") && (Ha = Vt, Ku = V, Fl = null);
            break;
          case "focusout":
            Fl = Ku = Ha = null;
            break;
          case "mousedown":
            ku = !0;
            break;
          case "contextmenu":
          case "mouseup":
          case "dragend":
            ku = !1, Pm(Z, n, Y);
            break;
          case "selectionchange":
            if (HT) break;
          case "keydown":
          case "keyup":
            Pm(Z, n, Y);
        }
        var bt;
        if (Yu)
          t: {
            switch (t) {
              case "compositionstart":
                var Et = "onCompositionStart";
                break t;
              case "compositionend":
                Et = "onCompositionEnd";
                break t;
              case "compositionupdate":
                Et = "onCompositionUpdate";
                break t;
            }
            Et = void 0;
          }
        else
          Ba ? Lm(t, n) && (Et = "onCompositionEnd") : t === "keydown" && n.keyCode === 229 && (Et = "onCompositionStart");
        Et && (Nm && n.locale !== "ko" && (Ba || Et !== "onCompositionStart" ? Et === "onCompositionEnd" && Ba && (bt = Cm()) : (ci = Y, Uu = "value" in ci ? ci.value : ci.textContent, Ba = !0)), Vt = br(V, Et), 0 < Vt.length && (Et = new zm(
          Et,
          t,
          null,
          n,
          Y
        ), Z.push({ event: Et, listeners: Vt }), bt ? Et.data = bt : (bt = Um(n), bt !== null && (Et.data = bt)))), (bt = DT ? OT(t, n) : zT(t, n)) && (Et = br(V, "onBeforeInput"), 0 < Et.length && (Vt = new zm(
          "onBeforeInput",
          "beforeinput",
          null,
          n,
          Y
        ), Z.push({
          event: Vt,
          listeners: Et
        }), Vt.data = bt)), DE(
          Z,
          t,
          V,
          n,
          Y
        );
      }
      My(Z, e);
    });
  }
  function Ts(t, e, n) {
    return {
      instance: t,
      listener: e,
      currentTarget: n
    };
  }
  function br(t, e) {
    for (var n = e + "Capture", l = []; t !== null; ) {
      var r = t, u = r.stateNode;
      if (r = r.tag, r !== 5 && r !== 26 && r !== 27 || u === null || (r = ql(t, n), r != null && l.unshift(
        Ts(t, r, u)
      ), r = ql(t, e), r != null && l.push(
        Ts(t, r, u)
      )), t.tag === 3) return l;
      t = t.return;
    }
    return [];
  }
  function NE(t) {
    if (t === null) return null;
    do
      t = t.return;
    while (t && t.tag !== 5 && t.tag !== 27);
    return t || null;
  }
  function Cy(t, e, n, l, r) {
    for (var u = e._reactName, m = []; n !== null && n !== l; ) {
      var b = n, x = b.alternate, V = b.stateNode;
      if (b = b.tag, x !== null && x === l) break;
      b !== 5 && b !== 26 && b !== 27 || V === null || (x = V, r ? (V = ql(n, u), V != null && m.unshift(
        Ts(n, V, x)
      )) : r || (V = ql(n, u), V != null && m.push(
        Ts(n, V, x)
      ))), n = n.return;
    }
    m.length !== 0 && t.push({ event: e, listeners: m });
  }
  var _E = /\r\n?/g, VE = /\u0000|\uFFFD/g;
  function Dy(t) {
    return (typeof t == "string" ? t : "" + t).replace(_E, `
`).replace(VE, "");
  }
  function Oy(t, e) {
    return e = Dy(e), Dy(t) === e;
  }
  function Kt(t, e, n, l, r, u) {
    switch (n) {
      case "children":
        if (typeof l == "string")
          e === "body" || e === "textarea" && l === "" || Va(t, l);
        else if (typeof l == "number" || typeof l == "bigint")
          e !== "body" && Va(t, "" + l);
        else return;
        break;
      case "className":
        fo(t, "class", l);
        break;
      case "tabIndex":
        fo(t, "tabindex", l);
        break;
      case "dir":
      case "role":
      case "viewBox":
      case "width":
      case "height":
        fo(t, n, l);
        break;
      case "style":
        xm(t, l, u);
        return;
      case "data":
        if (e !== "object") {
          fo(t, "data", l);
          break;
        }
      case "src":
      case "href":
        if (l === "" && (e !== "a" || n !== "href")) {
          t.removeAttribute(n);
          break;
        }
        if (l == null || typeof l == "function" || typeof l == "symbol" || typeof l == "boolean") {
          t.removeAttribute(n);
          break;
        }
        l = ho(l), t.setAttribute(n, l);
        break;
      case "action":
      case "formAction":
        if (typeof l == "function") {
          t.setAttribute(
            n,
            "javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().')"
          );
          break;
        } else
          typeof u == "function" && (n === "formAction" ? (e !== "input" && Kt(t, e, "name", r.name, r, null), Kt(
            t,
            e,
            "formEncType",
            r.formEncType,
            r,
            null
          ), Kt(
            t,
            e,
            "formMethod",
            r.formMethod,
            r,
            null
          ), Kt(
            t,
            e,
            "formTarget",
            r.formTarget,
            r,
            null
          )) : (Kt(t, e, "encType", r.encType, r, null), Kt(t, e, "method", r.method, r, null), Kt(t, e, "target", r.target, r, null)));
        if (l == null || typeof l == "symbol" || typeof l == "boolean") {
          t.removeAttribute(n);
          break;
        }
        l = ho(l), t.setAttribute(n, l);
        break;
      case "onClick":
        l != null && (t.onclick = Cn);
        return;
      case "onScroll":
        l != null && Nt("scroll", t);
        return;
      case "onScrollEnd":
        l != null && Nt("scrollend", t);
        return;
      case "dangerouslySetInnerHTML":
        if (l != null) {
          if (typeof l != "object" || !("__html" in l))
            throw Error(o(61));
          if (n = l.__html, n != null) {
            if (r.children != null) throw Error(o(60));
            (u != null ? u.__html : void 0) !== n && (t.innerHTML = n);
          }
        }
        break;
      case "multiple":
        t.multiple = l && typeof l != "function" && typeof l != "symbol";
        break;
      case "muted":
        t.muted = l && typeof l != "function" && typeof l != "symbol";
        break;
      case "suppressContentEditableWarning":
      case "suppressHydrationWarning":
      case "defaultValue":
      case "defaultChecked":
      case "innerHTML":
      case "ref":
        break;
      case "autoFocus":
        break;
      case "xlinkHref":
        if (l == null || typeof l == "function" || typeof l == "boolean" || typeof l == "symbol") {
          t.removeAttribute("xlink:href");
          break;
        }
        n = ho(l), t.setAttributeNS(
          "http://www.w3.org/1999/xlink",
          "xlink:href",
          n
        );
        break;
      case "contentEditable":
      case "spellCheck":
      case "draggable":
      case "value":
      case "autoReverse":
      case "externalResourcesRequired":
      case "focusable":
      case "preserveAlpha":
        l != null && typeof l != "function" && typeof l != "symbol" ? t.setAttribute(n, l) : t.removeAttribute(n);
        break;
      case "inert":
      case "allowFullScreen":
      case "async":
      case "autoPlay":
      case "controls":
      case "credentialless":
      case "default":
      case "defer":
      case "disabled":
      case "disablePictureInPicture":
      case "disableRemotePlayback":
      case "formNoValidate":
      case "hidden":
      case "loop":
      case "noModule":
      case "noValidate":
      case "open":
      case "playsInline":
      case "readOnly":
      case "required":
      case "reversed":
      case "scoped":
      case "seamless":
      case "itemScope":
        l && typeof l != "function" && typeof l != "symbol" ? t.setAttribute(n, "") : t.removeAttribute(n);
        break;
      case "capture":
      case "download":
        l === !0 ? t.setAttribute(n, "") : l !== !1 && l != null && typeof l != "function" && typeof l != "symbol" ? t.setAttribute(n, l) : t.removeAttribute(n);
        break;
      case "cols":
      case "rows":
      case "size":
      case "span":
        l != null && typeof l != "function" && typeof l != "symbol" && !isNaN(l) && 1 <= l ? t.setAttribute(n, l) : t.removeAttribute(n);
        break;
      case "rowSpan":
      case "start":
        l == null || typeof l == "function" || typeof l == "symbol" || isNaN(l) ? t.removeAttribute(n) : t.setAttribute(n, l);
        break;
      case "popover":
        Nt("beforetoggle", t), Nt("toggle", t), co(t, "popover", l);
        break;
      case "xlinkActuate":
        Xn(
          t,
          "http://www.w3.org/1999/xlink",
          "xlink:actuate",
          l
        );
        break;
      case "xlinkArcrole":
        Xn(
          t,
          "http://www.w3.org/1999/xlink",
          "xlink:arcrole",
          l
        );
        break;
      case "xlinkRole":
        Xn(
          t,
          "http://www.w3.org/1999/xlink",
          "xlink:role",
          l
        );
        break;
      case "xlinkShow":
        Xn(
          t,
          "http://www.w3.org/1999/xlink",
          "xlink:show",
          l
        );
        break;
      case "xlinkTitle":
        Xn(
          t,
          "http://www.w3.org/1999/xlink",
          "xlink:title",
          l
        );
        break;
      case "xlinkType":
        Xn(
          t,
          "http://www.w3.org/1999/xlink",
          "xlink:type",
          l
        );
        break;
      case "xmlBase":
        Xn(
          t,
          "http://www.w3.org/XML/1998/namespace",
          "xml:base",
          l
        );
        break;
      case "xmlLang":
        Xn(
          t,
          "http://www.w3.org/XML/1998/namespace",
          "xml:lang",
          l
        );
        break;
      case "xmlSpace":
        Xn(
          t,
          "http://www.w3.org/XML/1998/namespace",
          "xml:space",
          l
        );
        break;
      case "is":
        co(t, "is", l);
        break;
      case "innerText":
      case "textContent":
        return;
      default:
        if (!(2 < n.length) || n[0] !== "o" && n[0] !== "O" || n[1] !== "n" && n[1] !== "N")
          n = $S.get(n) || n, co(t, n, l);
        else return;
    }
    Bt = !0;
  }
  function zf(t, e, n, l, r, u) {
    switch (n) {
      case "style":
        xm(t, l, u);
        return;
      case "dangerouslySetInnerHTML":
        if (l != null) {
          if (typeof l != "object" || !("__html" in l))
            throw Error(o(61));
          if (n = l.__html, n != null) {
            if (r.children != null) throw Error(o(60));
            (u != null ? u.__html : void 0) !== n && (t.innerHTML = n);
          }
        }
        break;
      case "children":
        if (typeof l == "string") Va(t, l);
        else if (typeof l == "number" || typeof l == "bigint")
          Va(t, "" + l);
        else return;
        break;
      case "onScroll":
        l != null && Nt("scroll", t);
        return;
      case "onScrollEnd":
        l != null && Nt("scrollend", t);
        return;
      case "onClick":
        l != null && (t.onclick = Cn);
        return;
      case "suppressContentEditableWarning":
      case "suppressHydrationWarning":
      case "innerHTML":
      case "ref":
        return;
      case "innerText":
      case "textContent":
        return;
      default:
        if (!mm.hasOwnProperty(n))
          t: {
            if (n[0] === "o" && n[1] === "n" && (r = n.endsWith("Capture"), u = n.slice(2, r ? n.length - 7 : void 0), e = t[Le] || null, e = e != null ? e[n] : null, typeof e == "function" && t.removeEventListener(u, e, r), typeof l == "function")) {
              typeof e != "function" && e !== null && (n in t ? t[n] = null : t.hasAttribute(n) && t.removeAttribute(n)), t.addEventListener(u, l, r);
              break t;
            }
            Bt = !0, n in t ? t[n] = l : l === !0 ? t.setAttribute(n, "") : co(t, n, l);
          }
        return;
    }
    Bt = !0;
  }
  function xe(t, e, n) {
    switch (e) {
      case "div":
      case "span":
      case "svg":
      case "path":
      case "a":
      case "g":
      case "p":
      case "li":
        break;
      case "img":
        Nt("error", t), Nt("load", t);
        var l = !1, r = !1, u;
        for (u in n)
          if (n.hasOwnProperty(u)) {
            var m = n[u];
            if (m != null)
              switch (u) {
                case "src":
                  l = !0;
                  break;
                case "srcSet":
                  r = !0;
                  break;
                case "children":
                case "dangerouslySetInnerHTML":
                  throw Error(o(137, e));
                default:
                  Kt(t, e, u, m, n, null);
              }
          }
        r && Kt(t, e, "srcSet", n.srcSet, n, null), l && Kt(t, e, "src", n.src, n, null);
        return;
      case "input":
        Nt("invalid", t);
        var b = u = m = r = null, x = null, V = null;
        for (l in n)
          if (n.hasOwnProperty(l)) {
            var Y = n[l];
            if (Y != null)
              switch (l) {
                case "name":
                  r = Y;
                  break;
                case "type":
                  m = Y;
                  break;
                case "checked":
                  x = Y;
                  break;
                case "defaultChecked":
                  V = Y;
                  break;
                case "value":
                  u = Y;
                  break;
                case "defaultValue":
                  b = Y;
                  break;
                case "children":
                case "dangerouslySetInnerHTML":
                  if (Y != null)
                    throw Error(o(137, e));
                  break;
                default:
                  Kt(t, e, l, Y, n, null);
              }
          }
        Sm(
          t,
          u,
          b,
          x,
          V,
          m,
          r,
          !1
        );
        return;
      case "select":
        Nt("invalid", t), l = m = u = null;
        for (r in n)
          if (n.hasOwnProperty(r) && (b = n[r], b != null))
            switch (r) {
              case "value":
                u = b;
                break;
              case "defaultValue":
                m = b;
                break;
              case "multiple":
                l = b;
              default:
                Kt(t, e, r, b, n, null);
            }
        e = u, n = m, t.multiple = !!l, e != null ? _a(t, !!l, e, !1) : n != null && _a(t, !!l, n, !0);
        return;
      case "textarea":
        Nt("invalid", t), u = r = l = null;
        for (m in n)
          if (n.hasOwnProperty(m) && (b = n[m], b != null))
            switch (m) {
              case "value":
                l = b;
                break;
              case "defaultValue":
                r = b;
                break;
              case "children":
                u = b;
                break;
              case "dangerouslySetInnerHTML":
                if (b != null) throw Error(o(91));
                break;
              default:
                Kt(t, e, m, b, n, null);
            }
        Em(t, l, r, u);
        return;
      case "option":
        for (x in n)
          if (n.hasOwnProperty(x) && (l = n[x], l != null))
            switch (x) {
              case "selected":
                t.selected = l && typeof l != "function" && typeof l != "symbol";
                break;
              default:
                Kt(t, e, x, l, n, null);
            }
        return;
      case "dialog":
        Nt("beforetoggle", t), Nt("toggle", t), Nt("cancel", t), Nt("close", t);
        break;
      case "iframe":
      case "object":
        Nt("load", t);
        break;
      case "video":
      case "audio":
        for (l = 0; l < Ss.length; l++)
          Nt(Ss[l], t);
        break;
      case "image":
        Nt("error", t), Nt("load", t);
        break;
      case "details":
        Nt("toggle", t);
        break;
      case "embed":
      case "source":
      case "link":
        Nt("error", t), Nt("load", t);
      case "area":
      case "base":
      case "br":
      case "col":
      case "hr":
      case "keygen":
      case "meta":
      case "param":
      case "track":
      case "wbr":
      case "menuitem":
        for (V in n)
          if (n.hasOwnProperty(V) && (l = n[V], l != null))
            switch (V) {
              case "children":
              case "dangerouslySetInnerHTML":
                throw Error(o(137, e));
              default:
                Kt(t, e, V, l, n, null);
            }
        return;
      default:
        if (Ru(e)) {
          for (Y in n)
            n.hasOwnProperty(Y) && (l = n[Y], l !== void 0 && zf(
              t,
              e,
              Y,
              l,
              n,
              void 0
            ));
          return;
        }
    }
    for (b in n)
      n.hasOwnProperty(b) && (l = n[b], l != null && Kt(t, e, b, l, n, null));
  }
  var LE = {};
  function UE(t, e, n, l) {
    switch (e) {
      case "div":
      case "span":
      case "svg":
      case "path":
      case "a":
      case "g":
      case "p":
      case "li":
        break;
      case "input":
        var r = null, u = null, m = null, b = null, x = null, V = null, Y = null;
        for (j in n) {
          var Z = n[j];
          if (n.hasOwnProperty(j) && Z != null)
            switch (j) {
              case "checked":
                break;
              case "value":
                break;
              case "defaultValue":
                x = Z;
              default:
                l.hasOwnProperty(j) || Kt(t, e, j, null, l, Z);
            }
        }
        for (var R in l) {
          var j = l[R];
          if (Z = n[R], l.hasOwnProperty(R) && (j != null || Z != null))
            switch (R) {
              case "type":
                j !== Z && (Bt = !0), u = j;
                break;
              case "name":
                j !== Z && (Bt = !0), r = j;
                break;
              case "checked":
                j !== Z && (Bt = !0), V = j;
                break;
              case "defaultChecked":
                j !== Z && (Bt = !0), Y = j;
                break;
              case "value":
                j !== Z && (Bt = !0), m = j;
                break;
              case "defaultValue":
                j !== Z && (Bt = !0), b = j;
                break;
              case "children":
              case "dangerouslySetInnerHTML":
                if (j != null)
                  throw Error(o(137, e));
                break;
              default:
                j !== Z && Kt(
                  t,
                  e,
                  R,
                  j,
                  l,
                  Z
                );
            }
        }
        Ou(
          t,
          m,
          b,
          x,
          V,
          Y,
          u,
          r
        );
        return;
      case "select":
        j = m = b = R = null;
        for (u in n)
          if (x = n[u], n.hasOwnProperty(u) && x != null)
            switch (u) {
              case "value":
                break;
              case "multiple":
                j = x;
              default:
                l.hasOwnProperty(u) || Kt(
                  t,
                  e,
                  u,
                  null,
                  l,
                  x
                );
            }
        for (r in l)
          if (u = l[r], x = n[r], l.hasOwnProperty(r) && (u != null || x != null))
            switch (r) {
              case "value":
                u !== x && (Bt = !0), R = u;
                break;
              case "defaultValue":
                u !== x && (Bt = !0), b = u;
                break;
              case "multiple":
                u !== x && (Bt = !0), m = u;
              default:
                u !== x && Kt(
                  t,
                  e,
                  r,
                  u,
                  l,
                  x
                );
            }
        e = b, n = m, l = j, R != null ? _a(t, !!n, R, !1) : !!l != !!n && (e != null ? _a(t, !!n, e, !0) : _a(t, !!n, n ? [] : "", !1));
        return;
      case "textarea":
        j = R = null;
        for (b in n)
          if (r = n[b], n.hasOwnProperty(b) && r != null && !l.hasOwnProperty(b))
            switch (b) {
              case "value":
                break;
              case "children":
                break;
              default:
                Kt(t, e, b, null, l, r);
            }
        for (m in l)
          if (r = l[m], u = n[m], l.hasOwnProperty(m) && (r != null || u != null))
            switch (m) {
              case "value":
                r !== u && (Bt = !0), R = r;
                break;
              case "defaultValue":
                r !== u && (Bt = !0), j = r;
                break;
              case "children":
                break;
              case "dangerouslySetInnerHTML":
                if (r != null) throw Error(o(91));
                break;
              default:
                r !== u && Kt(t, e, m, r, l, u);
            }
        Tm(t, R, j);
        return;
      case "option":
        for (var ot in n)
          if (R = n[ot], n.hasOwnProperty(ot) && R != null && !l.hasOwnProperty(ot))
            switch (ot) {
              case "selected":
                t.selected = !1;
                break;
              default:
                Kt(
                  t,
                  e,
                  ot,
                  null,
                  l,
                  R
                );
            }
        for (x in l)
          if (R = l[x], j = n[x], l.hasOwnProperty(x) && R !== j && (R != null || j != null))
            switch (x) {
              case "selected":
                R !== j && (Bt = !0), t.selected = R && typeof R != "function" && typeof R != "symbol";
                break;
              default:
                Kt(
                  t,
                  e,
                  x,
                  R,
                  l,
                  j
                );
            }
        return;
      case "img":
      case "link":
      case "area":
      case "base":
      case "br":
      case "col":
      case "embed":
      case "hr":
      case "keygen":
      case "meta":
      case "param":
      case "source":
      case "track":
      case "wbr":
      case "menuitem":
        for (var yt in n)
          R = n[yt], n.hasOwnProperty(yt) && R != null && !l.hasOwnProperty(yt) && Kt(t, e, yt, null, l, R);
        for (V in l)
          if (R = l[V], j = n[V], l.hasOwnProperty(V) && R !== j && (R != null || j != null))
            switch (V) {
              case "children":
              case "dangerouslySetInnerHTML":
                if (R != null)
                  throw Error(o(137, e));
                break;
              default:
                Kt(
                  t,
                  e,
                  V,
                  R,
                  l,
                  j
                );
            }
        return;
      default:
        if (Ru(e)) {
          for (var Ct in n)
            R = n[Ct], n.hasOwnProperty(Ct) && R !== void 0 && !l.hasOwnProperty(Ct) && zf(
              t,
              e,
              Ct,
              void 0,
              l,
              R
            );
          for (Y in l)
            R = l[Y], j = n[Y], !l.hasOwnProperty(Y) || R === j || R === void 0 && j === void 0 || zf(
              t,
              e,
              Y,
              R,
              l,
              j
            );
          return;
        }
    }
    for (var _ in n)
      R = n[_], n.hasOwnProperty(_) && R != null && !l.hasOwnProperty(_) && Kt(t, e, _, null, l, R);
    for (Z in l)
      R = l[Z], j = n[Z], !l.hasOwnProperty(Z) || R === j || R == null && j == null || Kt(t, e, Z, R, l, j);
  }
  function zy(t) {
    switch (t) {
      case "css":
      case "script":
      case "font":
      case "img":
      case "image":
      case "input":
      case "link":
        return !0;
      default:
        return !1;
    }
  }
  function BE() {
    if (typeof performance.getEntriesByType == "function") {
      for (var t = 0, e = 0, n = performance.getEntriesByType("resource"), l = 0; l < n.length; l++) {
        var r = n[l], u = r.transferSize, m = r.initiatorType, b = r.duration;
        if (u && b && zy(m)) {
          for (m = 0, b = r.responseEnd, l += 1; l < n.length; l++) {
            var x = n[l], V = x.startTime;
            if (V > b) break;
            var Y = x.transferSize, Z = x.initiatorType;
            Y && zy(Z) && (x = x.responseEnd, m += Y * (x < b ? 1 : (b - V) / (x - V)));
          }
          if (--l, e += 8 * (u + m) / (r.duration / 1e3), t++, 10 < t) break;
        }
      }
      if (0 < t) return e / t / 1e6;
    }
    return navigator.connection && (t = navigator.connection.downlink, typeof t == "number") ? t : 5;
  }
  var Rf = null, Nf = null;
  function Es(t) {
    return t.nodeType === 9 ? t : t.ownerDocument;
  }
  function Ry(t) {
    switch (t) {
      case "http://www.w3.org/2000/svg":
        return 1;
      case "http://www.w3.org/1998/Math/MathML":
        return 2;
      default:
        return 0;
    }
  }
  function Ny(t, e) {
    if (t === 0)
      switch (e) {
        case "svg":
          return 1;
        case "math":
          return 2;
        default:
          return 0;
      }
    return t === 1 && e === "foreignObject" ? 0 : t;
  }
  function _y(t, e, n, l) {
    return n = Es(
      n
    ).createElement(t), n[be] = l, n[Le] = e, xe(n, t, e), pe(n), n;
  }
  function _f(t, e) {
    return t === "textarea" || t === "noscript" || typeof e.children == "string" || typeof e.children == "number" || typeof e.children == "bigint" || typeof e.dangerouslySetInnerHTML == "object" && e.dangerouslySetInnerHTML !== null && e.dangerouslySetInnerHTML.__html != null;
  }
  var Vf = null;
  function HE() {
    var t = window.event;
    return t && t.type === "popstate" ? t === Vf ? !1 : (Vf = t, !0) : (Vf = null, !1);
  }
  var Lf = typeof setTimeout == "function" ? setTimeout : void 0, jE = typeof clearTimeout == "function" ? clearTimeout : void 0, Vy = typeof Promise == "function" ? Promise : void 0, Ly = typeof requestAnimationFrame == "function" ? requestAnimationFrame : Lf, GE = typeof queueMicrotask == "function" ? queueMicrotask : typeof Vy < "u" ? function(t) {
    return Vy.resolve(null).then(t).catch(YE);
  } : Lf;
  function YE(t) {
    setTimeout(function() {
      throw t;
    });
  }
  function zi(t) {
    return t === "head";
  }
  function Uy(t, e) {
    var n = e, l = 0;
    do {
      var r = n.nextSibling;
      if (t.removeChild(n), r && r.nodeType === 8)
        if (n = r.data, n === "/$" || n === "/&") {
          if (l === 0) {
            t.removeChild(r), yl(e);
            return;
          }
          l--;
        } else if (n === "$" || n === "$?" || n === "$~" || n === "$!" || n === "&")
          l++;
        else if (n === "html")
          Xf(
            t.ownerDocument.documentElement
          );
        else if (n === "head") {
          n = t.ownerDocument.head, Xf(n);
          for (var u = n.firstChild; u; ) {
            var m = u.nextSibling, b = u.nodeName;
            u[Gl] || b === "SCRIPT" || b === "STYLE" || b === "LINK" && u.rel.toLowerCase() === "stylesheet" || n.removeChild(u), u = m;
          }
        } else
          n === "body" && Xf(t.ownerDocument.body);
      n = r;
    } while (n);
    yl(e);
  }
  function By(t, e) {
    var n = t;
    t = 0;
    do {
      var l = n.nextSibling;
      if (n.nodeType === 1 ? e ? (n._stashedDisplay = n.style.display, n.style.display = "none") : (n.style.display = n._stashedDisplay || "", n.getAttribute("style") === "" && n.removeAttribute("style")) : n.nodeType === 3 && (e ? (n._stashedText = n.nodeValue, n.nodeValue = "") : n.nodeValue = n._stashedText || ""), l && l.nodeType === 8)
        if (n = l.data, n === "/$") {
          if (t === 0) break;
          t--;
        } else
          n !== "$" && n !== "$?" && n !== "$~" && n !== "$!" || t++;
      n = l;
    } while (n);
  }
  function Hy(t, e, n) {
    if (e = CSS.escape(e) !== e ? "r-" + btoa(e).replace(/=/g, "") : e, t.style.viewTransitionName = e, n != null && (t.style.viewTransitionClass = n), n = getComputedStyle(t), n.display === "inline") {
      if (e = t.getClientRects(), e.length === 1) var l = 1;
      else
        for (var r = l = 0; r < e.length; r++) {
          var u = e[r];
          0 < u.width && 0 < u.height && l++;
        }
      l === 1 && (t = t.style, t.display = e.length === 1 ? "inline-block" : "block", t.marginTop = "-" + n.paddingTop, t.marginBottom = "-" + n.paddingBottom);
    }
  }
  function jy(t, e) {
    t = t.style, e = e.style;
    var n = e != null ? e.hasOwnProperty("viewTransitionName") ? e.viewTransitionName : e.hasOwnProperty("view-transition-name") ? e["view-transition-name"] : null : null;
    t.viewTransitionName = n == null || typeof n == "boolean" ? "" : ("" + n).trim(), n = e != null ? e.hasOwnProperty("viewTransitionClass") ? e.viewTransitionClass : e.hasOwnProperty("view-transition-class") ? e["view-transition-class"] : null : null, t.viewTransitionClass = n == null || typeof n == "boolean" ? "" : ("" + n).trim(), t.display === "inline-block" && (e == null ? t.display = t.margin = "" : (n = e.display, t.display = n == null || typeof n == "boolean" ? "" : n, n = e.margin, n != null ? t.margin = n : (n = e.hasOwnProperty("marginTop") ? e.marginTop : e["margin-top"], t.marginTop = n == null || typeof n == "boolean" ? "" : n, e = e.hasOwnProperty("marginBottom") ? e.marginBottom : e["margin-bottom"], t.marginBottom = e == null || typeof e == "boolean" ? "" : e)));
  }
  function qE(t, e, n) {
    return n = n.ownerDocument.defaultView, {
      rect: t,
      abs: e.position === "absolute" || e.position === "fixed",
      clip: e.clipPath !== "none" || e.overflow !== "visible" || e.filter !== "none" || e.mask !== "none" || e.mask !== "none" || e.borderRadius !== "0px",
      view: 0 <= t.bottom && 0 <= t.right && t.top <= n.innerHeight && t.left <= n.innerWidth
    };
  }
  function Uf(t) {
    var e = t.getBoundingClientRect(), n = getComputedStyle(t);
    return qE(e, n, t);
  }
  function XE(t) {
    return t.documentElement.clientHeight;
  }
  function QE(t) {
    this.addEventListener("load", t), this.addEventListener("error", t);
  }
  function ZE(t, e, n, l, r, u, m, b, x) {
    var V = e.nodeType === 9 ? e : e.ownerDocument;
    try {
      var Y = V.startViewTransition({
        update: function() {
          var R = V.defaultView, j = R.navigation && R.navigation.transition, ot = V.fonts.status;
          l();
          var yt = [];
          if (ot === "loaded" && (XE(V), V.fonts.status === "loading" && yt.push(V.fonts.ready)), ot = yt.length, t !== null)
            for (var Ct = t.suspenseyImages, _ = 0, O = 0; O < Ct.length; O++) {
              var B = Ct[O];
              if (!B.complete) {
                var Q = B.getBoundingClientRect();
                if (0 < Q.bottom && 0 < Q.right && Q.top < R.innerHeight && Q.left < R.innerWidth) {
                  if (_ += s0(B), _ > Er) {
                    yt.length = ot;
                    break;
                  }
                  B = new Promise(
                    QE.bind(B)
                  ), yt.push(B);
                }
              }
            }
          if (0 < yt.length)
            return R = Promise.race([
              Promise.all(yt),
              new Promise(function(ht) {
                return setTimeout(ht, 500);
              })
            ]).then(r, r), (j ? Promise.allSettled([j.finished, R]) : R).then(u, u);
          if (r(), j)
            return j.finished.then(
              u,
              u
            );
          u();
        },
        types: n
      });
      V.__reactViewTransition = Y;
      var Z = [];
      return Y.ready.then(
        function() {
          for (var R = V.documentElement.getAnimations({
            subtree: !0
          }), j = 0; j < R.length; j++) {
            var ot = R[j], yt = ot.effect, Ct = yt.pseudoElement;
            if (Ct != null && Ct.startsWith("::view-transition")) {
              Z.push(ot), ot = yt.getKeyframes();
              for (var _ = Ct = void 0, O = !0, B = 0; B < ot.length; B++) {
                var Q = ot[B], ht = Q.width;
                if (Ct === void 0) Ct = ht;
                else if (Ct !== ht) {
                  O = !1;
                  break;
                }
                if (ht = Q.height, _ === void 0) _ = ht;
                else if (_ !== ht) {
                  O = !1;
                  break;
                }
                delete Q.width, delete Q.height, Q.transform === "none" && delete Q.transform;
              }
              O && Ct !== void 0 && _ !== void 0 && (yt.setKeyframes(ot), O = getComputedStyle(
                yt.target,
                yt.pseudoElement
              ), O.width !== Ct || O.height !== _) && (O = ot[0], O.width = Ct, O.height = _, O = ot[ot.length - 1], O.width = Ct, O.height = _, yt.setKeyframes(ot));
            }
          }
          m();
        },
        function(R) {
          V.__reactViewTransition === Y && (V.__reactViewTransition = null);
          try {
            if (typeof R == "object" && R !== null)
              switch (R.name) {
                case "InvalidStateError":
                  (R.message === "View transition was skipped because document visibility state is hidden." || R.message === "Skipping view transition because document visibility state has become hidden." || R.message === "Skipping view transition because viewport size changed." || R.message === "Transition was aborted because of invalid state") && (R = null);
              }
            R !== null && x(R);
          } finally {
            l(), r(), m();
          }
        }
      ), Y.finished.finally(function() {
        for (var R = 0; R < Z.length; R++)
          Z[R].cancel();
        V.__reactViewTransition === Y && (V.__reactViewTransition = null), b();
      }), Y;
    } catch {
      return l(), r(), m(), null;
    }
  }
  function ma(t, e) {
    this._scope = document.documentElement, this._selector = "::view-transition-" + t + "(" + e + ")";
  }
  ma.prototype.animate = function(t, e) {
    return e = typeof e == "number" ? { duration: e } : z({}, e), e.pseudoElement = this._selector, this._scope.animate(t, e);
  }, ma.prototype.getAnimations = function() {
    for (var t = this._scope, e = this._selector, n = t.getAnimations({ subtree: !0 }), l = [], r = 0; r < n.length; r++) {
      var u = n[r].effect;
      u !== null && u.target === t && u.pseudoElement === e && l.push(n[r]);
    }
    return l;
  }, ma.prototype.getComputedStyle = function() {
    return getComputedStyle(this._scope, this._selector);
  };
  function Gy(t) {
    return {
      name: t,
      group: new ma("group", t),
      imagePair: new ma("image-pair", t),
      old: new ma("old", t),
      new: new ma("new", t)
    };
  }
  function We(t) {
    this._fragmentFiber = t, this._observers = this._eventListeners = null;
  }
  We.prototype.addEventListener = function(t, e, n) {
    var l = null, r = null;
    if (!(n != null && typeof n != "boolean" && (l = n.signal || null, l !== null && l.aborted))) {
      this._eventListeners === null && (this._eventListeners = []);
      var u = this._eventListeners;
      if (qy(u, t, e, n) === -1) {
        var m = this, b = e;
        n != null && typeof n != "boolean" && n.once === !0 && (b = function(x) {
          m.removeEventListener(
            t,
            e,
            n
          ), typeof e == "function" ? e.call(this, x) : e.handleEvent(x);
        }), l !== null && (r = m.removeEventListener.bind(
          m,
          t,
          e,
          n
        ), l.addEventListener("abort", r, { once: !0 }), r = l.removeEventListener.bind(l, "abort", r)), l = fl(n), u.push({
          type: t,
          listener: e,
          optionsOrUseCapture: n,
          attachedListener: b,
          cleanup: r
        }), y(
          this._fragmentFiber.child,
          !1,
          KE,
          t,
          b,
          l
        );
      }
      this._eventListeners = u;
    }
  };
  function KE(t, e, n, l) {
    return M(t).addEventListener(
      e,
      n,
      l
    ), !1;
  }
  We.prototype.removeEventListener = function(t, e, n) {
    var l = this._eventListeners;
    if (l !== null && (e = qy(
      l,
      t,
      e,
      n
    ), e !== -1)) {
      var r = l[e];
      n = r.attachedListener;
      var u = r.cleanup;
      r = fl(r.optionsOrUseCapture), y(
        this._fragmentFiber.child,
        !1,
        kE,
        t,
        n,
        r
      ), l.splice(e, 1), u !== null && u();
    }
  };
  function kE(t, e, n, l) {
    return M(t).removeEventListener(
      e,
      n,
      l
    ), !1;
  }
  function fl(t) {
    return t != null && typeof t != "boolean" && (t.once === !0 || t.signal instanceof AbortSignal) ? { capture: t.capture, passive: t.passive } : t;
  }
  function Yy(t) {
    return t == null ? "c=0" : typeof t == "boolean" ? "c=" + (t ? "1" : "0") : "c=" + (t.capture ? "1" : "0");
  }
  function qy(t, e, n, l) {
    if (t.length === 0) return -1;
    l = Yy(l);
    for (var r = 0; r < t.length; r++) {
      var u = t[r];
      if (u.type === e && u.listener === n && Yy(u.optionsOrUseCapture) === l)
        return r;
    }
    return -1;
  }
  We.prototype.dispatchEvent = function(t) {
    var e = S(
      this._fragmentFiber
    );
    if (e === null) return !0;
    e = M(e);
    var n = this._eventListeners;
    if (n !== null && 0 < n.length || !t.bubbles) {
      var l = e.nodeType === 9 ? e.createComment("") : document.createTextNode("");
      if (n)
        for (var r = 0; r < n.length; r++) {
          var u = n[r];
          l.addEventListener(
            u.type,
            u.attachedListener,
            fl(u.optionsOrUseCapture)
          );
        }
      if (e.appendChild(l), t = l.dispatchEvent(t), n)
        for (r = 0; r < n.length; r++)
          u = n[r], l.removeEventListener(
            u.type,
            u.attachedListener,
            fl(u.optionsOrUseCapture)
          );
      return e.removeChild(l), t;
    }
    return e.dispatchEvent(t);
  }, We.prototype.focus = function(t) {
    y(
      this._fragmentFiber.child,
      !0,
      Xy,
      t,
      void 0,
      void 0
    );
  };
  function Xy(t, e) {
    return t.tag === 6 ? !1 : (t = M(t), lA(t, e));
  }
  We.prototype.focusLast = function(t) {
    var e = [];
    y(
      this._fragmentFiber.child,
      !0,
      Bf,
      e,
      void 0,
      void 0
    );
    for (var n = e.length - 1; 0 <= n && !Xy(e[n], t); n--) ;
  };
  function Bf(t, e) {
    return e.push(t), !1;
  }
  We.prototype.blur = function() {
    var t = S(
      this._fragmentFiber
    );
    t !== null && (t = M(t), t = Es(t).activeElement, t !== null && y(
      this._fragmentFiber.child,
      !1,
      PE,
      t,
      void 0,
      void 0
    ));
  };
  function PE(t, e) {
    return t.tag === 6 ? !1 : (t = M(t), t === e || t.contains(e) ? (e.blur(), !0) : !1);
  }
  We.prototype.observeUsing = function(t) {
    this._observers === null && (this._observers = /* @__PURE__ */ new Set()), this._observers.add(t), y(
      this._fragmentFiber.child,
      !1,
      JE,
      t,
      void 0,
      void 0
    );
  };
  function JE(t, e) {
    return t.tag === 6 || (t = M(t), e.observe(t)), !1;
  }
  We.prototype.unobserveUsing = function(t) {
    var e = this._observers;
    if (e !== null && e.has(t)) {
      e.delete(t), y(
        this._fragmentFiber.child,
        !1,
        FE,
        t,
        void 0,
        void 0
      );
      for (var n = e = 0; n < vn.length; n++) {
        var l = vn[n];
        l.fragmentInstance === this && l.observer === t ? t.unobserve(l.instance) : vn[e++] = l;
      }
      vn.length = e;
    }
  };
  function FE(t, e) {
    return t.tag === 6 || (t = M(t), e.unobserve(t)), !1;
  }
  var vn = [], Hf = !1;
  function IE(t, e, n) {
    vn.push({
      fragmentInstance: t,
      observer: e,
      instance: n
    }), Hf || (Hf = !0, sA(function() {
      Hf = !1;
      var l = vn;
      vn = [];
      for (var r = 0; r < l.length; r++) {
        var u = l[r];
        u.observer.unobserve(u.instance);
      }
    }));
  }
  We.prototype.getClientRects = function() {
    var t = [];
    return y(
      this._fragmentFiber.child,
      !1,
      WE,
      t,
      void 0,
      void 0
    ), t;
  };
  function WE(t, e) {
    if (t.tag === 6) {
      t = t.stateNode;
      var n = t.ownerDocument.createRange();
      n.selectNodeContents(t), e.push.apply(e, n.getClientRects());
    } else
      t = M(t), e.push.apply(e, t.getClientRects());
    return !1;
  }
  We.prototype.getRootNode = function(t) {
    var e = S(
      this._fragmentFiber
    );
    return e === null ? this : M(e).getRootNode(t);
  }, We.prototype.compareDocumentPosition = function(t) {
    var e = S(
      this._fragmentFiber
    );
    if (e === null) return Node.DOCUMENT_POSITION_DISCONNECTED;
    var n = [];
    y(
      this._fragmentFiber.child,
      !1,
      Bf,
      n,
      void 0,
      void 0
    );
    var l = M(e);
    if (n.length === 0) {
      if (n = l, E(this._fragmentFiber)) {
        t: {
          for (e = this._fragmentFiber.return; e !== null; ) {
            if (e.tag === 4) {
              e = e.stateNode.containerInfo;
              break t;
            }
            if (e.tag === 3 || e.tag === 5 || e.tag === 27)
              break;
            e = e.return;
          }
          e = null;
        }
        e != null && (n = e);
      }
      e = this._fragmentFiber;
      var r = l = n.compareDocumentPosition(t);
      return n === t ? r = Node.DOCUMENT_POSITION_CONTAINS : l & Node.DOCUMENT_POSITION_CONTAINED_BY && (n = A(e)[1], n === null ? r = Node.DOCUMENT_POSITION_PRECEDING : (t = M(n).compareDocumentPosition(
        t
      ), r = t === 0 || t & Node.DOCUMENT_POSITION_FOLLOWING ? Node.DOCUMENT_POSITION_FOLLOWING : Node.DOCUMENT_POSITION_PRECEDING)), r |= Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC;
    }
    e = M(n[0]), r = M(n[n.length - 1]);
    var u = E(this._fragmentFiber) ? e.parentElement : l;
    if (u == null)
      return Node.DOCUMENT_POSITION_DISCONNECTED;
    l = u.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_CONTAINED_BY, u = u.compareDocumentPosition(r) & Node.DOCUMENT_POSITION_CONTAINED_BY;
    var m = e.compareDocumentPosition(t), b = r.compareDocumentPosition(t), x = m & Node.DOCUMENT_POSITION_CONTAINED_BY || b & Node.DOCUMENT_POSITION_CONTAINED_BY;
    return b = l && u && m & Node.DOCUMENT_POSITION_FOLLOWING && b & Node.DOCUMENT_POSITION_PRECEDING, e = l && e === t || u && r === t || x || b ? Node.DOCUMENT_POSITION_CONTAINED_BY : !l && e === t || !u && r === t ? Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC : m, e & Node.DOCUMENT_POSITION_DISCONNECTED || e & Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC || $E(
      e,
      this._fragmentFiber,
      n[0],
      n[n.length - 1],
      t
    ) ? e : Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC;
  };
  function $E(t, e, n, l, r) {
    var u = ki(r);
    if (t & Node.DOCUMENT_POSITION_CONTAINED_BY) {
      if (n = !!u)
        t: {
          for (; u !== null; ) {
            if (u.tag === 7 && (u === e || u.alternate === e)) {
              n = !0;
              break t;
            }
            u = u.return;
          }
          n = !1;
        }
      return n;
    }
    if (t & Node.DOCUMENT_POSITION_CONTAINS) {
      if (u === null)
        return u = r.ownerDocument, r === u || r === u.documentElement || r === u.body;
      t: {
        for (u = e, e = S(e); u !== null; ) {
          if (!(u.tag !== 5 && u.tag !== 3 && u.tag !== 27 || u !== e && u.alternate !== e)) {
            u = !0;
            break t;
          }
          u = u.return;
        }
        u = !1;
      }
      return u;
    }
    return t & Node.DOCUMENT_POSITION_PRECEDING ? ((e = !!u) && !(e = u === n) && (e = et(
      n,
      u,
      I
    ), e === null ? e = !1 : (y(
      e,
      !0,
      H,
      u,
      n
    ), u = C, C = null, e = u !== null)), e) : t & Node.DOCUMENT_POSITION_FOLLOWING ? ((e = !!u) && !(e = u === l) && (e = et(
      l,
      u,
      I
    ), e === null ? e = !1 : (y(
      e,
      !0,
      X,
      u,
      l
    ), u = C, N = C = null, e = u !== null)), e) : !1;
  }
  function Qy(t, e) {
    var n = t.ownerDocument.createRange();
    n.selectNodeContents(t), t = n.getBoundingClientRect(), window.scrollTo(
      window.scrollX + t.left,
      e ? window.scrollY + t.top : window.scrollY + t.bottom - window.innerHeight
    );
  }
  We.prototype.scrollIntoView = function(t) {
    if (typeof t == "object") throw Error(o(566));
    var e = [];
    y(
      this._fragmentFiber.child,
      !1,
      Bf,
      e,
      void 0,
      void 0
    );
    var n = t !== !1;
    if (e.length === 0) {
      var l = A(
        this._fragmentFiber
      );
      if (l = n ? l[1] || l[0] || S(this._fragmentFiber) : l[0] || l[1], l === null) return;
      if (l.tag === 6) {
        t = M(l), Qy(t, n);
        return;
      }
      if (l = M(l), l.nodeType !== 9) {
        if (l.nodeType === 11) {
          n = "host" in l ? l.host : null, n !== null && n.scrollIntoView(t);
          return;
        }
        l.scrollIntoView(t);
      }
    }
    for (l = n ? e.length - 1 : 0; l !== (n ? -1 : e.length); ) {
      var r = e[l];
      r.tag === 6 ? (r = M(r), Qy(r, n)) : M(r).scrollIntoView(t), l += n ? -1 : 1;
    }
  };
  function tA(t, e) {
    return t = M(t), Zy(t, e), !1;
  }
  function Zy(t, e) {
    t.reactFragments == null && (t.reactFragments = /* @__PURE__ */ new Set()), t.reactFragments.add(e);
  }
  function Ky(t, e) {
    var n = e._eventListeners;
    if (n !== null)
      for (var l = 0; l < n.length; l++) {
        var r = n[l];
        t.addEventListener(
          r.type,
          r.attachedListener,
          fl(r.optionsOrUseCapture)
        );
      }
    t.nodeType !== 3 && (n = e._observers, n !== null && n.forEach(function(u) {
      for (var m = 0, b = 0; b < vn.length; b++) {
        var x = vn[b];
        (x.fragmentInstance !== e || x.observer !== u || x.instance !== t) && (vn[m++] = x);
      }
      vn.length = m, u.observe(t);
    }), Zy(t, e));
  }
  function eA(t, e) {
    var n = e._eventListeners;
    if (n !== null)
      for (var l = 0; l < n.length; l++) {
        var r = n[l];
        t.removeEventListener(
          r.type,
          r.attachedListener,
          fl(r.optionsOrUseCapture)
        );
      }
    t.nodeType !== 3 && (n = e._observers, n !== null && n.forEach(function(u) {
      typeof u.rootMargin == "string" ? IE(
        e,
        u,
        t
      ) : u.unobserve(t);
    }), t.reactFragments != null && t.reactFragments.delete(e));
  }
  function jf(t) {
    var e = t.firstChild;
    for (e && e.nodeType === 10 && (e = e.nextSibling); e; ) {
      var n = e;
      switch (e = e.nextSibling, n.nodeName) {
        case "HTML":
        case "HEAD":
        case "BODY":
          jf(n), uo(n);
          continue;
        case "SCRIPT":
        case "STYLE":
          continue;
        case "LINK":
          if (n.rel.toLowerCase() === "stylesheet") continue;
      }
      t.removeChild(n);
    }
  }
  function nA(t, e, n, l) {
    for (; t.nodeType === 1; ) {
      var r = n;
      if (t.nodeName.toLowerCase() !== e.toLowerCase()) {
        if (!l && (t.nodeName !== "INPUT" || t.type !== "hidden"))
          break;
      } else if (l) {
        if (!t[Gl])
          switch (e) {
            case "meta":
              if (!t.hasAttribute("itemprop")) break;
              return t;
            case "link":
              if (u = t.getAttribute("rel"), u === "stylesheet" && t.hasAttribute("data-precedence"))
                break;
              if (u !== r.rel || t.getAttribute("href") !== (r.href == null || r.href === "" ? null : r.href) || t.getAttribute("crossorigin") !== (r.crossOrigin == null ? null : r.crossOrigin) || t.getAttribute("title") !== (r.title == null ? null : r.title))
                break;
              return t;
            case "style":
              if (t.hasAttribute("data-precedence")) break;
              return t;
            case "script":
              if (u = t.getAttribute("src"), (u !== (r.src == null ? null : r.src) || t.getAttribute("type") !== (r.type == null ? null : r.type) || t.getAttribute("crossorigin") !== (r.crossOrigin == null ? null : r.crossOrigin)) && u && t.hasAttribute("async") && !t.hasAttribute("itemprop"))
                break;
              return t;
            default:
              return t;
          }
      } else if (e === "input" && t.type === "hidden") {
        var u = r.name == null ? null : "" + r.name;
        if (r.type === "hidden" && t.getAttribute("name") === u)
          return t;
      } else return t;
      if (t = cn(t.nextSibling), t === null) break;
    }
    return null;
  }
  function iA(t, e, n) {
    if (e === "") return null;
    for (; t.nodeType !== 3; )
      if ((t.nodeType !== 1 || t.nodeName !== "INPUT" || t.type !== "hidden") && !n || (t = cn(t.nextSibling), t === null)) return null;
    return t;
  }
  function ky(t, e) {
    for (; t.nodeType !== 8; )
      if ((t.nodeType !== 1 || t.nodeName !== "INPUT" || t.type !== "hidden") && !e || (t = cn(t.nextSibling), t === null)) return null;
    return t;
  }
  function Gf(t) {
    return t.data === "$?" || t.data === "$~";
  }
  function Yf(t) {
    return t.data === "$!" || t.data === "$?" && t.ownerDocument.readyState !== "loading";
  }
  function aA(t, e) {
    var n = t.ownerDocument;
    if (t.data === "$~") t._reactRetry = e;
    else if (t.data !== "$?" || n.readyState !== "loading")
      e();
    else {
      var l = function() {
        e(), n.removeEventListener("DOMContentLoaded", l);
      };
      n.addEventListener("DOMContentLoaded", l), t._reactRetry = l;
    }
  }
  function cn(t) {
    for (; t != null; t = t.nextSibling) {
      var e = t.nodeType;
      if (e === 1 || e === 3) break;
      if (e === 8) {
        if (e = t.data, e === "$" || e === "$!" || e === "$?" || e === "$~" || e === "&" || e === "F!" || e === "F")
          break;
        if (e === "/$" || e === "/&") return null;
      }
    }
    return t;
  }
  var qf = null;
  function Py(t) {
    t = t.nextSibling;
    for (var e = 0; t; ) {
      if (t.nodeType === 8) {
        var n = t.data;
        if (n === "/$" || n === "/&") {
          if (e === 0)
            return cn(t.nextSibling);
          e--;
        } else
          n !== "$" && n !== "$!" && n !== "$?" && n !== "$~" && n !== "&" || e++;
      }
      t = t.nextSibling;
    }
    return null;
  }
  function Jy(t) {
    t = t.previousSibling;
    for (var e = 0; t; ) {
      if (t.nodeType === 8) {
        var n = t.data;
        if (n === "$" || n === "$!" || n === "$?" || n === "$~" || n === "&") {
          if (e === 0) return t;
          e--;
        } else n !== "/$" && n !== "/&" || e++;
      }
      t = t.previousSibling;
    }
    return null;
  }
  function lA(t, e) {
    function n() {
      l = !0;
    }
    if (t.ownerDocument.activeElement === t) return !0;
    var l = !1;
    try {
      t.ownerDocument.addEventListener("focus", n, !0), (t.focus || HTMLElement.prototype.focus).call(t, e);
    } finally {
      t.ownerDocument.removeEventListener("focus", n, !0);
    }
    return l;
  }
  function sA(t) {
    Ly(function() {
      Ly(function(e) {
        return t(e);
      });
    });
  }
  function Fy(t, e, n) {
    switch (e = Es(n), t) {
      case "html":
        if (t = e.documentElement, !t) throw Error(o(452));
        return t;
      case "head":
        if (t = e.head, !t) throw Error(o(453));
        return t;
      case "body":
        if (t = e.body, !t) throw Error(o(454));
        return t;
      default:
        throw Error(o(451));
    }
  }
  function Iy(t, e, n) {
    for (var l in n) {
      var r = n[l];
      n.hasOwnProperty(l) && r != null && Kt(t, e, l, null, LE, r);
    }
    n.dangerouslySetInnerHTML != null && (t.textContent = ""), t.onclick === Cn && (t.onclick = null), uo(t);
  }
  function Xf(t) {
    for (var e = t.attributes; e.length; )
      t.removeAttributeNode(e[0]);
    uo(t);
  }
  var fn = /* @__PURE__ */ new Map(), Wy = /* @__PURE__ */ new Set();
  function As(t) {
    if (typeof t.getRootNode == "function") {
      var e = t.getRootNode();
      if (e.nodeType === 9 || e.nodeType === 11) return e;
    }
    return t.nodeType === 9 ? t : t.ownerDocument;
  }
  var ni = G.d;
  G.d = {
    f: oA,
    r: rA,
    D: uA,
    C: cA,
    L: fA,
    m: dA,
    X: mA,
    S: hA,
    M: pA
  };
  function oA() {
    var t = ni.f(), e = hr();
    return t || e;
  }
  function rA(t) {
    var e = za(t);
    e !== null && e.tag === 5 && e.type === "form" ? tg(e) : ni.r(t);
  }
  var dl = typeof document > "u" ? null : document;
  function $y(t, e, n) {
    var l = dl;
    if (l && typeof e == "string" && e) {
      var r = nn(e);
      r = 'link[rel="' + t + '"][href="' + r + '"]', typeof n == "string" && (r += '[crossorigin="' + n + '"]'), Wy.has(r) || (Wy.add(r), t = { rel: t, crossOrigin: n, href: e }, l.querySelector(r) === null && (e = l.createElement("link"), xe(e, "link", t), pe(e), l.head.appendChild(e)));
    }
  }
  function uA(t) {
    ni.D(t), $y("dns-prefetch", t, null);
  }
  function cA(t, e) {
    ni.C(t, e), $y("preconnect", t, e);
  }
  function fA(t, e, n) {
    ni.L(t, e, n);
    var l = dl;
    if (l && t && e) {
      var r = 'link[rel="preload"][as="' + nn(e) + '"]';
      e === "image" && n && n.imageSrcSet ? (r += '[imagesrcset="' + nn(
        n.imageSrcSet
      ) + '"]', typeof n.imageSizes == "string" && (r += '[imagesizes="' + nn(
        n.imageSizes
      ) + '"]')) : r += '[href="' + nn(t) + '"]';
      var u = r;
      switch (e) {
        case "style":
          u = hl(t);
          break;
        case "script":
          u = ml(t);
      }
      if (!(fn.has(u) || (t = z(
        {
          rel: "preload",
          href: e === "image" && n && n.imageSrcSet ? void 0 : t,
          as: e
        },
        n
      ), fn.set(u, t), l.querySelector(r) !== null || e === "style" && l.querySelector(xs(u)) || e === "script" && l.querySelector(Ms(u))))) {
        var m = l.createElement("link");
        xe(m, "link", t), e === "style" && (m[ro] = !0, m.onload = m.onerror = function() {
          dm(m);
        }), pe(m), l.head.appendChild(m);
      }
    }
  }
  function dA(t, e) {
    ni.m(t, e);
    var n = dl;
    if (n && t) {
      var l = e && typeof e.as == "string" ? e.as : "script", r = 'link[rel="modulepreload"][as="' + nn(l) + '"][href="' + nn(t) + '"]', u = r;
      switch (l) {
        case "audioworklet":
        case "paintworklet":
        case "serviceworker":
        case "sharedworker":
        case "worker":
        case "script":
          u = ml(t);
      }
      if (!fn.has(u) && (t = z({ rel: "modulepreload", href: t }, e), fn.set(u, t), n.querySelector(r) === null)) {
        switch (l) {
          case "audioworklet":
          case "paintworklet":
          case "serviceworker":
          case "sharedworker":
          case "worker":
          case "script":
            if (n.querySelector(Ms(u)))
              return;
        }
        l = n.createElement("link"), xe(l, "link", t), pe(l), n.head.appendChild(l);
      }
    }
  }
  function hA(t, e, n) {
    ni.S(t, e, n);
    var l = dl;
    if (l && t) {
      var r = Ra(l).hoistableStyles, u = hl(t);
      e = e || "default";
      var m = r.get(u);
      if (!m) {
        var b = { loading: 0, preload: null };
        if (m = l.querySelector(
          xs(u)
        ))
          b.loading = 5;
        else {
          t = z(
            { rel: "stylesheet", href: t, "data-precedence": e },
            n
          ), (n = fn.get(u)) && Qf(t, n);
          var x = m = l.createElement("link");
          pe(x), xe(x, "link", t), x._p = new Promise(function(V, Y) {
            x.onload = V, x.onerror = Y;
          }), x.addEventListener("load", function() {
            b.loading |= 1;
          }), x.addEventListener("error", function() {
            b.loading |= 2;
          }), b.loading |= 4, Sr(m, e, l);
        }
        m = {
          type: "stylesheet",
          instance: m,
          count: 1,
          state: b
        }, r.set(u, m);
      }
    }
  }
  function mA(t, e) {
    ni.X(t, e);
    var n = dl;
    if (n && t) {
      var l = Ra(n).hoistableScripts, r = ml(t), u = l.get(r);
      u || (u = n.querySelector(Ms(r)), u || (t = z({ src: t, async: !0 }, e), (e = fn.get(r)) && Zf(t, e), u = n.createElement("script"), pe(u), xe(u, "link", t), n.head.appendChild(u)), u = {
        type: "script",
        instance: u,
        count: 1,
        state: null
      }, l.set(r, u));
    }
  }
  function pA(t, e) {
    ni.M(t, e);
    var n = dl;
    if (n && t) {
      var l = Ra(n).hoistableScripts, r = ml(t), u = l.get(r);
      u || (u = n.querySelector(Ms(r)), u || (t = z({ src: t, async: !0, type: "module" }, e), (e = fn.get(r)) && Zf(t, e), u = n.createElement("script"), pe(u), xe(u, "link", t), n.head.appendChild(u)), u = {
        type: "script",
        instance: u,
        count: 1,
        state: null
      }, l.set(r, u));
    }
  }
  function t0(t, e, n, l) {
    var r = (r = Ve.current) ? As(r) : null;
    if (!r) throw Error(o(446));
    switch (t) {
      case "meta":
      case "title":
        return null;
      case "style":
        return typeof n.precedence == "string" && typeof n.href == "string" ? (n = hl(n.href), e = Ra(
          r
        ).hoistableStyles, l = e.get(n), l || (l = {
          type: "style",
          instance: null,
          count: 0,
          state: null
        }, e.set(n, l)), l) : { type: "void", instance: null, count: 0, state: null };
      case "link":
        if (n.rel === "stylesheet" && typeof n.href == "string" && typeof n.precedence == "string") {
          t = hl(n.href);
          var u = Ra(
            r
          ).hoistableStyles, m = u.get(t);
          if (m || (r = r.ownerDocument || r, m = {
            type: "stylesheet",
            instance: null,
            count: 0,
            state: { loading: 0, preload: null }
          }, u.set(t, m), (u = r.querySelector(
            xs(t)
          )) ? u._p || (m.instance = u, m.state.loading = 5) : (u = fn.get(t), u || (u = {
            rel: "preload",
            as: "style",
            href: n.href,
            crossOrigin: n.crossOrigin,
            integrity: n.integrity,
            media: n.media,
            hrefLang: n.hrefLang,
            referrerPolicy: n.referrerPolicy
          }, fn.set(t, u)), gA(
            r,
            t,
            u,
            m.state
          ))), e && l === null)
            throw Error(o(528, ""));
          return m;
        }
        if (e && l !== null)
          throw Error(o(529, ""));
        return null;
      case "script":
        return e = n.async, n = n.src, typeof n == "string" && e && typeof e != "function" && typeof e != "symbol" ? (n = ml(n), e = Ra(
          r
        ).hoistableScripts, l = e.get(n), l || (l = {
          type: "script",
          instance: null,
          count: 0,
          state: null
        }, e.set(n, l)), l) : { type: "void", instance: null, count: 0, state: null };
      default:
        throw Error(o(444, t));
    }
  }
  function hl(t) {
    return 'href="' + nn(t) + '"';
  }
  function xs(t) {
    return 'link[rel="stylesheet"][' + t + "]";
  }
  function e0(t) {
    return z({}, t, {
      "data-precedence": t.precedence,
      precedence: null
    });
  }
  function gA(t, e, n, l) {
    if (e = t.querySelector(
      'link[rel="preload"][as="style"][' + e + "]"
    )) {
      if (e[ro] !== !0) {
        l.loading = 1;
        return;
      }
    } else
      e = t.createElement("link"), e[ro] = !0, e.onload = e.onerror = dm.bind(null, e), xe(e, "link", n), pe(e), t.head.appendChild(e);
    l.preload = e, e.addEventListener("load", function() {
      return l.loading |= 1;
    }), e.addEventListener("error", function() {
      return l.loading |= 2;
    });
  }
  function ml(t) {
    return '[src="' + nn(t) + '"]';
  }
  function Ms(t) {
    return "script[async]" + t;
  }
  function n0(t, e, n) {
    if (e.count++, e.instance === null)
      switch (e.type) {
        case "style":
          var l = t.querySelector(
            'style[data-href~="' + nn(n.href) + '"]'
          );
          if (l)
            return e.instance = l, pe(l), l;
          var r = z({}, n, {
            "data-href": n.href,
            "data-precedence": n.precedence,
            href: null,
            precedence: null
          });
          return l = (t.ownerDocument || t).createElement(
            "style"
          ), pe(l), xe(l, "style", r), Sr(l, n.precedence, t), e.instance = l;
        case "stylesheet":
          r = hl(n.href);
          var u = t.querySelector(
            xs(r)
          );
          if (u)
            return e.state.loading |= 4, e.instance = u, pe(u), u;
          l = e0(n), (r = fn.get(r)) && Qf(l, r), u = (t.ownerDocument || t).createElement("link"), pe(u);
          var m = u;
          return m._p = new Promise(function(b, x) {
            m.onload = b, m.onerror = x;
          }), xe(u, "link", l), e.state.loading |= 4, Sr(u, n.precedence, t), e.instance = u;
        case "script":
          return u = ml(n.src), (r = t.querySelector(
            Ms(u)
          )) ? (e.instance = r, pe(r), r) : (l = n, (r = fn.get(u)) && (l = z({}, n), Zf(l, r)), t = t.ownerDocument || t, r = t.createElement("script"), pe(r), xe(r, "link", l), t.head.appendChild(r), e.instance = r);
        case "void":
          return null;
        default:
          throw Error(o(443, e.type));
      }
    else
      e.type === "stylesheet" && (e.state.loading & 4) === 0 && (l = e.instance, e.state.loading |= 4, Sr(l, n.precedence, t));
    return e.instance;
  }
  function Sr(t, e, n) {
    for (var l = n.querySelectorAll(
      'link[rel="stylesheet"][data-precedence],style[data-precedence]'
    ), r = l.length ? l[l.length - 1] : null, u = r, m = 0; m < l.length; m++) {
      var b = l[m];
      if (b.dataset.precedence === e) u = b;
      else if (u !== r) break;
    }
    u ? u.parentNode.insertBefore(t, u.nextSibling) : (e = n.nodeType === 9 ? n.head : n, e.insertBefore(t, e.firstChild));
  }
  function Qf(t, e) {
    t.crossOrigin == null && (t.crossOrigin = e.crossOrigin), t.referrerPolicy == null && (t.referrerPolicy = e.referrerPolicy), t.title == null && (t.title = e.title);
  }
  function Zf(t, e) {
    t.crossOrigin == null && (t.crossOrigin = e.crossOrigin), t.referrerPolicy == null && (t.referrerPolicy = e.referrerPolicy), t.integrity == null && (t.integrity = e.integrity);
  }
  var Tr = null;
  function i0(t, e, n) {
    if (Tr === null) {
      var l = /* @__PURE__ */ new Map(), r = Tr = /* @__PURE__ */ new Map();
      r.set(n, l);
    } else
      r = Tr, l = r.get(n), l || (l = /* @__PURE__ */ new Map(), r.set(n, l));
    if (l.has(t)) return l;
    for (l.set(t, null), n = n.getElementsByTagName(t), r = 0; r < n.length; r++) {
      var u = n[r];
      if (!(u[Gl] || u[be] || t === "link" && u.getAttribute("rel") === "stylesheet") && u.namespaceURI !== "http://www.w3.org/2000/svg") {
        var m = u.getAttribute(e) || "";
        m = t + m;
        var b = l.get(m);
        b ? b.push(u) : l.set(m, [u]);
      }
    }
    return l;
  }
  function Kf(t, e, n) {
    t = t.ownerDocument || t, t.head.insertBefore(
      n,
      e === "title" ? t.querySelector("head > title") : null
    );
  }
  function yA(t, e, n) {
    if (n === 1 || e.itemProp != null) return !1;
    switch (t) {
      case "meta":
      case "title":
        return !0;
      case "style":
        if (typeof e.precedence != "string" || typeof e.href != "string" || e.href === "")
          break;
        return !0;
      case "link":
        if (typeof e.rel != "string" || typeof e.href != "string" || e.href === "" || e.onLoad || e.onError)
          break;
        switch (e.rel) {
          case "stylesheet":
            return t = e.disabled, typeof e.precedence == "string" && t == null;
          default:
            return !0;
        }
      case "script":
        if (e.async && typeof e.async != "function" && typeof e.async != "symbol" && !e.onLoad && !e.onError && e.src && typeof e.src == "string")
          return !0;
    }
    return !1;
  }
  function a0(t, e) {
    return t === "img" && e.src != null && e.src !== "" && e.onLoad == null && e.loading !== "lazy";
  }
  function l0(t) {
    return !(t.type === "stylesheet" && (t.state.loading & 3) === 0);
  }
  function s0(t) {
    return (t.width || 100) * (t.height || 100) * (typeof devicePixelRatio == "number" ? devicePixelRatio : 1) * 0.25;
  }
  function o0(t, e) {
    typeof e.decode == "function" && (t.imgCount++, e.complete || (t.imgBytes += s0(e), t.suspenseyImages.push(e)), t = SA.bind(t), e.decode().then(t, t));
  }
  function vA(t, e, n, l) {
    if (n.type === "stylesheet" && (typeof l.media != "string" || matchMedia(l.media).matches !== !1) && (n.state.loading & 4) === 0) {
      if (n.instance === null) {
        var r = hl(l.href), u = e.querySelector(
          xs(r)
        );
        if (u) {
          e = u._p, e !== null && typeof e == "object" && typeof e.then == "function" && (t.count++, t = ws.bind(t), e.then(t, t)), n.state.loading |= 4, n.instance = u, pe(u);
          return;
        }
        u = e.ownerDocument || e, l = e0(l), (r = fn.get(r)) && Qf(l, r), u = u.createElement("link"), pe(u);
        var m = u;
        m._p = new Promise(function(b, x) {
          m.onload = b, m.onerror = x;
        }), xe(u, "link", l), n.instance = u;
      }
      t.stylesheets === null && (t.stylesheets = /* @__PURE__ */ new Map()), t.stylesheets.set(n, e), (e = n.state.preload) && (n.state.loading & 3) === 0 && (t.count++, n = ws.bind(t), e.addEventListener("load", n), e.addEventListener("error", n));
    }
  }
  var Er = 0;
  function bA(t, e) {
    return t.stylesheets && t.count === 0 && xr(t, t.stylesheets), 0 < t.count || 0 < t.imgCount ? function(n) {
      var l = setTimeout(function() {
        if (t.stylesheets && xr(t, t.stylesheets), t.unsuspend) {
          var u = t.unsuspend;
          t.unsuspend = null, u();
        }
      }, 6e4 + e);
      0 < t.imgBytes && Er === 0 && (Er = 62500 * BE());
      var r = setTimeout(
        function() {
          if (t.waitingForImages = !1, t.count === 0 && (t.stylesheets && xr(t, t.stylesheets), t.unsuspend)) {
            var u = t.unsuspend;
            t.unsuspend = null, u();
          }
        },
        (t.imgBytes > Er ? 50 : 800) + e
      );
      return t.unsuspend = n, function() {
        t.unsuspend = null, clearTimeout(l), clearTimeout(r);
      };
    } : null;
  }
  function r0(t) {
    if (t.count === 0 && (t.imgCount === 0 || !t.waitingForImages)) {
      if (t.stylesheets) xr(t, t.stylesheets);
      else if (t.unsuspend) {
        var e = t.unsuspend;
        t.unsuspend = null, e();
      }
    }
  }
  function ws() {
    this.count--, r0(this);
  }
  function SA() {
    this.imgCount--, r0(this);
  }
  var Ar = null;
  function xr(t, e) {
    t.stylesheets = null, t.unsuspend !== null && (t.count++, Ar = /* @__PURE__ */ new Map(), e.forEach(TA, t), Ar = null, ws.call(t));
  }
  function TA(t, e) {
    if (!(e.state.loading & 4)) {
      var n = Ar.get(t);
      if (n) var l = n.get(null);
      else {
        n = /* @__PURE__ */ new Map(), Ar.set(t, n);
        for (var r = t.querySelectorAll(
          "link[data-precedence],style[data-precedence]"
        ), u = 0; u < r.length; u++) {
          var m = r[u];
          (m.nodeName === "LINK" || m.getAttribute("media") !== "not all") && (n.set(m.dataset.precedence, m), l = m);
        }
        l && n.set(null, l);
      }
      r = e.instance, m = r.getAttribute("data-precedence"), u = n.get(m) || l, u === l && n.set(null, r), n.set(m, r), this.count++, l = ws.bind(this), r.addEventListener("load", l), r.addEventListener("error", l), u ? u.parentNode.insertBefore(r, u.nextSibling) : (t = t.nodeType === 9 ? t.head : t, t.insertBefore(r, t.firstChild)), e.state.loading |= 4;
    }
  }
  var pl = {
    $$typeof: St,
    Provider: null,
    Consumer: null,
    _currentValue: ct,
    _currentValue2: ct,
    _threadCount: 0
  };
  function EA(t, e, n, l, r, u, m, b, x) {
    this.tag = 1, this.containerInfo = t, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = -1, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = Mu(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = Mu(0), this.hiddenUpdates = Mu(null), this.identifierPrefix = l, this.onUncaughtError = r, this.onCaughtError = u, this.onRecoverableError = m, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = x, this.transitionTypes = null, this.incompleteTransitions = /* @__PURE__ */ new Map();
  }
  function u0(t, e, n, l, r, u, m, b, x, V, Y, Z) {
    return t = new EA(
      t,
      e,
      n,
      m,
      x,
      V,
      Y,
      Z,
      b
    ), e = 1, u === !0 && (e |= 24), u = Ue(3, null, null, e), t.current = u, u.stateNode = t, e = sc(), e.refCount++, t.pooledCache = e, e.refCount++, u.memoizedState = {
      element: l,
      isDehydrated: n,
      cache: e
    }, cc(u), t;
  }
  function c0(t) {
    return t ? (t = Ya, t) : Ya;
  }
  function f0(t, e, n, l, r, u) {
    r = c0(r), l.context === null ? l.context = r : l.pendingContext = r, l = vi(e), l.payload = { element: n }, u = u === void 0 ? null : u, u !== null && (l.callback = u), n = bi(t, l, e), n !== null && (Ge(n, t, e), is(n, t, e));
  }
  function d0(t, e) {
    if (t = t.memoizedState, t !== null && t.dehydrated !== null) {
      var n = t.retryLane;
      t.retryLane = n !== 0 && n < e ? n : e;
    }
  }
  function kf(t, e) {
    d0(t, e), (t = t.alternate) && d0(t, e);
  }
  function h0(t) {
    if (t.tag === 13 || t.tag === 31) {
      var e = Ii(t, 67108864);
      e !== null && Ge(e, t, 67108864), kf(t, 67108864);
    }
  }
  function m0(t) {
    if (t.tag === 13 || t.tag === 31) {
      var e = Ie();
      e = wu(e);
      var n = Ii(t, e);
      n !== null && Ge(n, t, e), kf(t, e);
    }
  }
  var gl = !0;
  function AA(t, e, n, l) {
    var r = P.T;
    P.T = null;
    var u = G.p;
    try {
      G.p = 2, Pf(t, e, n, l);
    } finally {
      G.p = u, P.T = r;
    }
  }
  function xA(t, e, n, l) {
    var r = P.T;
    P.T = null;
    var u = G.p;
    try {
      G.p = 8, Pf(t, e, n, l);
    } finally {
      G.p = u, P.T = r;
    }
  }
  function Pf(t, e, n, l) {
    if (gl) {
      var r = Jf(l);
      if (r === null)
        Of(
          t,
          e,
          l,
          Mr,
          n
        ), g0(t, l);
      else if (wA(
        r,
        t,
        e,
        n,
        l
      ))
        l.stopPropagation();
      else if (g0(t, l), e & 4 && -1 < MA.indexOf(t)) {
        for (; r !== null; ) {
          var u = za(r);
          if (u !== null)
            switch (u.tag) {
              case 3:
                if (u = u.stateNode, u.current.memoizedState.isDehydrated) {
                  var m = Ki(u.pendingLanes);
                  if (m !== 0) {
                    var b = u;
                    for (b.pendingLanes |= 2, b.entangledLanes |= 2; m; ) {
                      var x = 1 << 31 - Qe(m);
                      b.entanglements[1] |= x, m &= ~x;
                    }
                    Bn(u), (jt & 6) === 0 && (cr = we() + 500, bs(0));
                  }
                }
                break;
              case 31:
              case 13:
                b = Ii(u, 2), b !== null && Ge(b, u, 2), hr(), kf(u, 2);
            }
          if (u = Jf(l), u === null && Of(
            t,
            e,
            l,
            Mr,
            n
          ), u === r) break;
          r = u;
        }
        r !== null && l.stopPropagation();
      } else
        Of(
          t,
          e,
          l,
          null,
          n
        );
    }
  }
  function Jf(t) {
    return t = _u(t), Ff(t);
  }
  var Mr = null;
  function Ff(t) {
    if (Mr = null, t = ki(t), t !== null) {
      var e = d(t);
      if (e === null) t = null;
      else {
        var n = e.tag;
        if (n === 13) {
          if (t = f(e), t !== null) return t;
          t = null;
        } else if (n === 31) {
          if (t = h(e), t !== null) return t;
          t = null;
        } else if (n === 3) {
          if (e.stateNode.current.memoizedState.isDehydrated)
            return e.tag === 3 ? e.stateNode.containerInfo : null;
          t = null;
        } else e !== t && (t = null);
      }
    }
    return Mr = t, null;
  }
  function p0(t) {
    switch (t) {
      case "beforetoggle":
      case "cancel":
      case "click":
      case "close":
      case "contextmenu":
      case "copy":
      case "cut":
      case "auxclick":
      case "dblclick":
      case "dragend":
      case "dragstart":
      case "drop":
      case "focusin":
      case "focusout":
      case "input":
      case "invalid":
      case "keydown":
      case "keypress":
      case "keyup":
      case "mousedown":
      case "mouseup":
      case "paste":
      case "pause":
      case "play":
      case "pointercancel":
      case "pointerdown":
      case "pointerup":
      case "ratechange":
      case "reset":
      case "seeked":
      case "submit":
      case "toggle":
      case "touchcancel":
      case "touchend":
      case "touchstart":
      case "volumechange":
      case "change":
      case "selectionchange":
      case "textInput":
      case "compositionstart":
      case "compositionend":
      case "compositionupdate":
      case "beforeblur":
      case "afterblur":
      case "beforeinput":
      case "blur":
      case "fullscreenchange":
      case "fullscreenerror":
      case "focus":
      case "hashchange":
      case "popstate":
      case "select":
      case "selectstart":
        return 2;
      case "drag":
      case "dragenter":
      case "dragexit":
      case "dragleave":
      case "dragover":
      case "mousemove":
      case "mouseout":
      case "mouseover":
      case "pointermove":
      case "pointerout":
      case "pointerover":
      case "resize":
      case "scroll":
      case "touchmove":
      case "wheel":
      case "mouseenter":
      case "mouseleave":
      case "pointerenter":
      case "pointerleave":
        return 8;
      case "message":
        switch (Eu()) {
          case Vl:
            return 2;
          case Ll:
            return 8;
          case Zi:
          case Au:
            return 32;
          case Ul:
            return 268435456;
          default:
            return 32;
        }
      default:
        return 32;
    }
  }
  var If = !1, Ri = null, Ni = null, _i = null, Cs = /* @__PURE__ */ new Map(), Ds = /* @__PURE__ */ new Map(), Vi = [], MA = "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset".split(
    " "
  );
  function g0(t, e) {
    switch (t) {
      case "focusin":
      case "focusout":
        Ri = null;
        break;
      case "dragenter":
      case "dragleave":
        Ni = null;
        break;
      case "mouseover":
      case "mouseout":
        _i = null;
        break;
      case "pointerover":
      case "pointerout":
        Cs.delete(e.pointerId);
        break;
      case "gotpointercapture":
      case "lostpointercapture":
        Ds.delete(e.pointerId);
    }
  }
  function Os(t, e, n, l, r, u) {
    return t === null || t.nativeEvent !== u ? (t = {
      blockedOn: e,
      domEventName: n,
      eventSystemFlags: l,
      nativeEvent: u,
      targetContainers: [r]
    }, e !== null && (e = za(e), e !== null && h0(e)), t) : (t.eventSystemFlags |= l, e = t.targetContainers, r !== null && e.indexOf(r) === -1 && e.push(r), t);
  }
  function wA(t, e, n, l, r) {
    switch (e) {
      case "focusin":
        return Ri = Os(
          Ri,
          t,
          e,
          n,
          l,
          r
        ), !0;
      case "dragenter":
        return Ni = Os(
          Ni,
          t,
          e,
          n,
          l,
          r
        ), !0;
      case "mouseover":
        return _i = Os(
          _i,
          t,
          e,
          n,
          l,
          r
        ), !0;
      case "pointerover":
        var u = r.pointerId;
        return Cs.set(
          u,
          Os(
            Cs.get(u) || null,
            t,
            e,
            n,
            l,
            r
          )
        ), !0;
      case "gotpointercapture":
        return u = r.pointerId, Ds.set(
          u,
          Os(
            Ds.get(u) || null,
            t,
            e,
            n,
            l,
            r
          )
        ), !0;
    }
    return !1;
  }
  function y0(t) {
    var e = ki(t.target);
    if (e !== null) {
      var n = d(e);
      if (n !== null) {
        if (e = n.tag, e === 13) {
          if (e = f(n), e !== null) {
            t.blockedOn = e, um(t.priority, function() {
              m0(n);
            });
            return;
          }
        } else if (e === 31) {
          if (e = h(n), e !== null) {
            t.blockedOn = e, um(t.priority, function() {
              m0(n);
            });
            return;
          }
        } else if (e === 3 && n.stateNode.current.memoizedState.isDehydrated) {
          t.blockedOn = n.tag === 3 ? n.stateNode.containerInfo : null;
          return;
        }
      }
    }
    t.blockedOn = null;
  }
  function wr(t) {
    if (t.blockedOn !== null) return !1;
    for (var e = t.targetContainers; 0 < e.length; ) {
      var n = Jf(t.nativeEvent);
      if (n === null) {
        n = t.nativeEvent;
        var l = new n.constructor(
          n.type,
          n
        );
        Nu = l, n.target.dispatchEvent(l), Nu = null;
      } else
        return e = za(n), e !== null && h0(e), t.blockedOn = n, !1;
      e.shift();
    }
    return !0;
  }
  function v0(t, e, n) {
    wr(t) && n.delete(e);
  }
  function CA() {
    If = !1, Ri !== null && wr(Ri) && (Ri = null), Ni !== null && wr(Ni) && (Ni = null), _i !== null && wr(_i) && (_i = null), Cs.forEach(v0), Ds.forEach(v0);
  }
  function Cr(t, e) {
    t.blockedOn === e && (t.blockedOn = null, If || (If = !0, i.unstable_scheduleCallback(
      i.unstable_NormalPriority,
      CA
    )));
  }
  var Dr = null;
  function b0(t) {
    Dr !== t && (Dr = t, i.unstable_scheduleCallback(
      i.unstable_NormalPriority,
      function() {
        Dr === t && (Dr = null);
        for (var e = 0; e < t.length; e += 3) {
          var n = t[e], l = t[e + 1], r = t[e + 2];
          if (typeof l != "function") {
            if (Ff(l || n) === null)
              continue;
            break;
          }
          var u = za(n);
          u !== null && (t.splice(e, 3), e -= 3, Rc(
            u,
            {
              pending: !0,
              data: r,
              method: n.method,
              action: l
            },
            l,
            r
          ));
        }
      }
    ));
  }
  function yl(t) {
    function e(x) {
      return Cr(x, t);
    }
    Ri !== null && Cr(Ri, t), Ni !== null && Cr(Ni, t), _i !== null && Cr(_i, t), Cs.forEach(e), Ds.forEach(e);
    for (var n = 0; n < Vi.length; n++) {
      var l = Vi[n];
      l.blockedOn === t && (l.blockedOn = null);
    }
    for (; 0 < Vi.length && (n = Vi[0], n.blockedOn === null); )
      y0(n), n.blockedOn === null && Vi.shift();
    if (n = (t.ownerDocument || t).$$reactFormReplay, n != null)
      for (l = 0; l < n.length; l += 3) {
        var r = n[l], u = n[l + 1], m = r[Le] || null;
        if (typeof u == "function")
          m || b0(n);
        else if (m) {
          var b = null;
          if (u && u.hasAttribute("formAction")) {
            if (r = u, m = u[Le] || null)
              b = m.formAction;
            else if (Ff(r) !== null) continue;
          } else b = m.action;
          typeof b == "function" ? n[l + 1] = b : (n.splice(l, 3), l -= 3), b0(n);
        }
      }
  }
  function S0() {
    function t(u) {
      u.canIntercept && u.info === "react-transition" && u.intercept({
        handler: function() {
          return new Promise(function(m) {
            return r = m;
          });
        },
        focusReset: "manual",
        scroll: "manual"
      });
    }
    function e() {
      r !== null && (r(), r = null), l || setTimeout(n, 20);
    }
    function n() {
      if (!l && !navigation.transition) {
        var u = navigation.currentEntry;
        u && u.url != null && navigation.navigate(u.url, {
          state: u.getState(),
          info: "react-transition",
          history: "replace"
        });
      }
    }
    if (typeof navigation == "object") {
      var l = !1, r = null;
      return navigation.addEventListener("navigate", t), navigation.addEventListener("navigatesuccess", e), navigation.addEventListener("navigateerror", e), setTimeout(n, 100), function() {
        l = !0, navigation.removeEventListener("navigate", t), navigation.removeEventListener("navigatesuccess", e), navigation.removeEventListener("navigateerror", e), r !== null && (r(), r = null);
      };
    }
  }
  function Wf(t) {
    this._internalRoot = t;
  }
  Or.prototype.render = Wf.prototype.render = function(t) {
    var e = this._internalRoot;
    if (e === null) throw Error(o(409));
    var n = e.current, l = Ie();
    f0(n, l, t, e, null, null);
  }, Or.prototype.unmount = Wf.prototype.unmount = function() {
    var t = this._internalRoot;
    if (t !== null) {
      this._internalRoot = null;
      var e = t.containerInfo;
      f0(t.current, 2, null, t, null, null), hr(), e[Oa] = null;
    }
  };
  function Or(t) {
    this._internalRoot = t;
  }
  Or.prototype.unstable_scheduleHydration = function(t) {
    if (t) {
      var e = rm();
      t = { blockedOn: null, target: t, priority: e };
      for (var n = 0; n < Vi.length && e !== 0 && e < Vi[n].priority; n++) ;
      Vi.splice(n, 0, t), n === 0 && y0(t);
    }
  };
  var T0 = a.version;
  if (T0 !== "19.3.1")
    throw Error(
      o(
        527,
        T0,
        "19.3.1"
      )
    );
  G.findDOMNode = function(t) {
    var e = t._reactInternals;
    if (e === void 0)
      throw typeof t.render == "function" ? Error(o(188)) : (t = Object.keys(t).join(","), Error(o(268, t)));
    return t = g(e), t = t !== null ? v(t) : null, t = t === null ? null : t.stateNode, t;
  };
  var DA = {
    bundleType: 0,
    version: "19.3.1",
    rendererPackageName: "react-dom",
    currentDispatcherRef: P,
    reconcilerVersion: "19.3.1"
  };
  if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u") {
    var zr = __REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!zr.isDisabled && zr.supportsFiber)
      try {
        Bl = zr.inject(
          DA
        ), Xe = zr;
      } catch {
      }
  }
  return zs.createRoot = function(t, e) {
    if (!c(t)) throw Error(o(299));
    var n = !1, l = "", r = cg, u = fg, m = dg;
    return e != null && (e.unstable_strictMode === !0 && (n = !0), e.identifierPrefix !== void 0 && (l = e.identifierPrefix), e.onUncaughtError !== void 0 && (r = e.onUncaughtError), e.onCaughtError !== void 0 && (u = e.onCaughtError), e.onRecoverableError !== void 0 && (m = e.onRecoverableError)), e = u0(
      t,
      1,
      !1,
      null,
      null,
      n,
      l,
      null,
      r,
      u,
      m,
      S0
    ), t[Oa] = e.current, Df(t), new Wf(e);
  }, zs.hydrateRoot = function(t, e, n) {
    if (!c(t)) throw Error(o(299));
    var l = !1, r = "", u = cg, m = fg, b = dg, x = null;
    return n != null && (n.unstable_strictMode === !0 && (l = !0), n.identifierPrefix !== void 0 && (r = n.identifierPrefix), n.onUncaughtError !== void 0 && (u = n.onUncaughtError), n.onCaughtError !== void 0 && (m = n.onCaughtError), n.onRecoverableError !== void 0 && (b = n.onRecoverableError), n.formState !== void 0 && (x = n.formState)), e = u0(
      t,
      1,
      !0,
      e,
      n ?? null,
      l,
      r,
      x,
      u,
      m,
      b,
      S0
    ), e.context = c0(null), n = e.current, l = Ie(), l = wu(l), r = vi(l), r.callback = null, bi(n, r, l), n = l, e.current.lanes = n, jl(e, n), Bn(e), t[Oa] = e.current, Df(t), new Or(e);
  }, zs.version = "19.3.1", zs;
}
var O0;
function YA() {
  if (O0) return td.exports;
  O0 = 1;
  function i() {
    if (!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != "function"))
      try {
        __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(i);
      } catch (a) {
        console.error(a);
      }
  }
  return i(), td.exports = GA(), td.exports;
}
var ad = YA(), qA = wb();
function XA(i) {
  return Object.prototype.toString.call(i) === "[object Object]";
}
function z0(i) {
  return XA(i) || Array.isArray(i);
}
function QA() {
  return !!(typeof window < "u" && window.document && window.document.createElement);
}
function rh(i, a) {
  const s = Object.keys(i), o = Object.keys(a);
  if (s.length !== o.length) return !1;
  const c = JSON.stringify(Object.keys(i.breakpoints || {})), d = JSON.stringify(Object.keys(a.breakpoints || {}));
  return c !== d ? !1 : s.every((f) => {
    const h = i[f], p = a[f];
    return typeof h == "function" ? `${h}` == `${p}` : !z0(h) || !z0(p) ? h === p : rh(h, p);
  });
}
function R0(i) {
  return i.concat().sort((a, s) => a.name > s.name ? 1 : -1).map((a) => a.options);
}
function ZA(i, a) {
  if (i.length !== a.length) return !1;
  const s = R0(i), o = R0(a);
  return s.every((c, d) => {
    const f = o[d];
    return rh(c, f);
  });
}
function uh(i) {
  return typeof i == "number";
}
function Od(i) {
  return typeof i == "string";
}
function fu(i) {
  return typeof i == "boolean";
}
function N0(i) {
  return Object.prototype.toString.call(i) === "[object Object]";
}
function te(i) {
  return Math.abs(i);
}
function ch(i) {
  return Math.sign(i);
}
function Hs(i, a) {
  return te(i - a);
}
function KA(i, a) {
  if (i === 0 || a === 0 || te(i) <= te(a)) return 0;
  const s = Hs(te(i), te(a));
  return te(s / i);
}
function kA(i) {
  return Math.round(i * 100) / 100;
}
function Ys(i) {
  return qs(i).map(Number);
}
function An(i) {
  return i[$s(i)];
}
function $s(i) {
  return Math.max(0, i.length - 1);
}
function fh(i, a) {
  return a === $s(i);
}
function _0(i, a = 0) {
  return Array.from(Array(i), (s, o) => a + o);
}
function qs(i) {
  return Object.keys(i);
}
function Cb(i, a) {
  return [i, a].reduce((s, o) => (qs(o).forEach((c) => {
    const d = s[c], f = o[c], h = N0(d) && N0(f);
    s[c] = h ? Cb(d, f) : f;
  }), s), {});
}
function zd(i, a) {
  return typeof a.MouseEvent < "u" && i instanceof a.MouseEvent;
}
function PA(i, a) {
  const s = {
    start: o,
    center: c,
    end: d
  };
  function o() {
    return 0;
  }
  function c(p) {
    return d(p) / 2;
  }
  function d(p) {
    return a - p;
  }
  function f(p, g) {
    return Od(i) ? s[i](p) : i(a, p, g);
  }
  return {
    measure: f
  };
}
function Xs() {
  let i = [];
  function a(c, d, f, h = {
    passive: !0
  }) {
    let p;
    if ("addEventListener" in c)
      c.addEventListener(d, f, h), p = () => c.removeEventListener(d, f, h);
    else {
      const g = c;
      g.addListener(f), p = () => g.removeListener(f);
    }
    return i.push(p), o;
  }
  function s() {
    i = i.filter((c) => c());
  }
  const o = {
    add: a,
    clear: s
  };
  return o;
}
function JA(i, a, s, o) {
  const c = Xs(), d = 1e3 / 60;
  let f = null, h = 0, p = 0;
  function g() {
    c.add(i, "visibilitychange", () => {
      i.hidden && A();
    });
  }
  function v() {
    E(), c.clear();
  }
  function y(M) {
    if (!p) return;
    f || (f = M, s(), s());
    const C = M - f;
    for (f = M, h += C; h >= d; )
      s(), h -= d;
    const N = h / d;
    o(N), p && (p = a.requestAnimationFrame(y));
  }
  function S() {
    p || (p = a.requestAnimationFrame(y));
  }
  function E() {
    a.cancelAnimationFrame(p), f = null, h = 0, p = 0;
  }
  function A() {
    f = null, h = 0;
  }
  return {
    init: g,
    destroy: v,
    start: S,
    stop: E,
    update: s,
    render: o
  };
}
function FA(i, a) {
  const s = a === "rtl", o = i === "y", c = o ? "y" : "x", d = o ? "x" : "y", f = !o && s ? -1 : 1, h = v(), p = y();
  function g(A) {
    const {
      height: w,
      width: M
    } = A;
    return o ? w : M;
  }
  function v() {
    return o ? "top" : s ? "right" : "left";
  }
  function y() {
    return o ? "bottom" : s ? "left" : "right";
  }
  function S(A) {
    return A * f;
  }
  return {
    scroll: c,
    cross: d,
    startEdge: h,
    endEdge: p,
    measureSize: g,
    direction: S
  };
}
function Ta(i = 0, a = 0) {
  const s = te(i - a);
  function o(g) {
    return g < i;
  }
  function c(g) {
    return g > a;
  }
  function d(g) {
    return o(g) || c(g);
  }
  function f(g) {
    return d(g) ? o(g) ? i : a : g;
  }
  function h(g) {
    return s ? g - s * Math.ceil((g - a) / s) : g;
  }
  return {
    length: s,
    max: a,
    min: i,
    constrain: f,
    reachedAny: d,
    reachedMax: c,
    reachedMin: o,
    removeOffset: h
  };
}
function Db(i, a, s) {
  const {
    constrain: o
  } = Ta(0, i), c = i + 1;
  let d = f(a);
  function f(S) {
    return s ? te((c + S) % c) : o(S);
  }
  function h() {
    return d;
  }
  function p(S) {
    return d = f(S), y;
  }
  function g(S) {
    return v().set(h() + S);
  }
  function v() {
    return Db(i, h(), s);
  }
  const y = {
    get: h,
    set: p,
    add: g,
    clone: v
  };
  return y;
}
function IA(i, a, s, o, c, d, f, h, p, g, v, y, S, E, A, w, M, C, N) {
  const {
    cross: H,
    direction: X
  } = i, I = ["INPUT", "SELECT", "TEXTAREA"], et = {
    passive: !1
  }, z = Xs(), D = Xs(), at = Ta(50, 225).constrain(E.measure(20)), lt = {
    mouse: 300,
    touch: 400
  }, st = {
    mouse: 500,
    touch: 600
  }, dt = A ? 43 : 25;
  let vt = !1, xt = 0, St = 0, F = !1, rt = !1, ut = !1, nt = !1;
  function L(G) {
    if (!N) return;
    function ct(Xt) {
      (fu(N) || N(G, Xt)) && k(Xt);
    }
    const Tt = a;
    z.add(Tt, "dragstart", (Xt) => Xt.preventDefault(), et).add(Tt, "touchmove", () => {
    }, et).add(Tt, "touchend", () => {
    }).add(Tt, "touchstart", ct).add(Tt, "mousedown", ct).add(Tt, "touchcancel", it).add(Tt, "contextmenu", it).add(Tt, "click", W, !0);
  }
  function K() {
    z.clear(), D.clear();
  }
  function $() {
    const G = nt ? s : a;
    D.add(G, "touchmove", J, et).add(G, "touchend", it).add(G, "mousemove", J, et).add(G, "mouseup", it);
  }
  function tt(G) {
    const ct = G.nodeName || "";
    return I.includes(ct);
  }
  function T() {
    return (A ? st : lt)[nt ? "mouse" : "touch"];
  }
  function U(G, ct) {
    const Tt = y.add(ch(G) * -1), Xt = v.byDistance(G, !A).distance;
    return A || te(G) < at ? Xt : M && ct ? Xt * 0.5 : v.byIndex(Tt.get(), 0).distance;
  }
  function k(G) {
    const ct = zd(G, o);
    nt = ct, ut = A && ct && !G.buttons && vt, vt = Hs(c.get(), f.get()) >= 2, !(ct && G.button !== 0) && (tt(G.target) || (F = !0, d.pointerDown(G), g.useFriction(0).useDuration(0), c.set(f), $(), xt = d.readPoint(G), St = d.readPoint(G, H), S.emit("pointerDown")));
  }
  function J(G) {
    if (!zd(G, o) && G.touches.length >= 2) return it(G);
    const Tt = d.readPoint(G), Xt = d.readPoint(G, H), Ht = Hs(Tt, xt), Ut = Hs(Xt, St);
    if (!rt && !nt && (!G.cancelable || (rt = Ht > Ut, !rt)))
      return it(G);
    const Mt = d.pointerMove(G);
    Ht > w && (ut = !0), g.useFriction(0.3).useDuration(0.75), h.start(), c.add(X(Mt)), G.preventDefault();
  }
  function it(G) {
    const Tt = v.byDistance(0, !1).index !== y.get(), Xt = d.pointerUp(G) * T(), Ht = U(X(Xt), Tt), Ut = KA(Xt, Ht), Mt = dt - 10 * Ut, ie = C + Ut / 50;
    rt = !1, F = !1, D.clear(), g.useDuration(Mt).useFriction(ie), p.distance(Ht, !A), nt = !1, S.emit("pointerUp");
  }
  function W(G) {
    ut && (G.stopPropagation(), G.preventDefault(), ut = !1);
  }
  function ft() {
    return F;
  }
  return {
    init: L,
    destroy: K,
    pointerDown: ft
  };
}
function WA(i, a) {
  let o, c;
  function d(y) {
    return y.timeStamp;
  }
  function f(y, S) {
    const A = `client${(S || i.scroll) === "x" ? "X" : "Y"}`;
    return (zd(y, a) ? y : y.touches[0])[A];
  }
  function h(y) {
    return o = y, c = y, f(y);
  }
  function p(y) {
    const S = f(y) - f(c), E = d(y) - d(o) > 170;
    return c = y, E && (o = y), S;
  }
  function g(y) {
    if (!o || !c) return 0;
    const S = f(c) - f(o), E = d(y) - d(o), A = d(y) - d(c) > 170, w = S / E;
    return E && !A && te(w) > 0.1 ? w : 0;
  }
  return {
    pointerDown: h,
    pointerMove: p,
    pointerUp: g,
    readPoint: f
  };
}
function $A() {
  function i(s) {
    const {
      offsetTop: o,
      offsetLeft: c,
      offsetWidth: d,
      offsetHeight: f
    } = s;
    return {
      top: o,
      right: c + d,
      bottom: o + f,
      left: c,
      width: d,
      height: f
    };
  }
  return {
    measure: i
  };
}
function tx(i) {
  function a(o) {
    return i * (o / 100);
  }
  return {
    measure: a
  };
}
function ex(i, a, s, o, c, d, f) {
  const h = [i].concat(o);
  let p, g, v = [], y = !1;
  function S(M) {
    return c.measureSize(f.measure(M));
  }
  function E(M) {
    if (!d) return;
    g = S(i), v = o.map(S);
    function C(N) {
      for (const H of N) {
        if (y) return;
        const X = H.target === i, I = o.indexOf(H.target), et = X ? g : v[I], z = S(X ? i : o[I]);
        if (te(z - et) >= 0.5) {
          M.reInit(), a.emit("resize");
          break;
        }
      }
    }
    p = new ResizeObserver((N) => {
      (fu(d) || d(M, N)) && C(N);
    }), s.requestAnimationFrame(() => {
      h.forEach((N) => p.observe(N));
    });
  }
  function A() {
    y = !0, p && p.disconnect();
  }
  return {
    init: E,
    destroy: A
  };
}
function nx(i, a, s, o, c, d) {
  let f = 0, h = 0, p = c, g = d, v = i.get(), y = 0;
  function S() {
    const et = o.get() - i.get(), z = !p;
    let D = 0;
    return z ? (f = 0, s.set(o), i.set(o), D = et) : (s.set(i), f += et / p, f *= g, v += f, i.add(f), D = v - y), h = ch(D), y = v, I;
  }
  function E() {
    const et = o.get() - a.get();
    return te(et) < 1e-3;
  }
  function A() {
    return p;
  }
  function w() {
    return h;
  }
  function M() {
    return f;
  }
  function C() {
    return H(c);
  }
  function N() {
    return X(d);
  }
  function H(et) {
    return p = et, I;
  }
  function X(et) {
    return g = et, I;
  }
  const I = {
    direction: w,
    duration: A,
    velocity: M,
    seek: S,
    settled: E,
    useBaseFriction: N,
    useBaseDuration: C,
    useFriction: X,
    useDuration: H
  };
  return I;
}
function ix(i, a, s, o, c) {
  const d = c.measure(10), f = c.measure(50), h = Ta(0.1, 0.99);
  let p = !1;
  function g() {
    return !(p || !i.reachedAny(s.get()) || !i.reachedAny(a.get()));
  }
  function v(E) {
    if (!g()) return;
    const A = i.reachedMin(a.get()) ? "min" : "max", w = te(i[A] - a.get()), M = s.get() - a.get(), C = h.constrain(w / f);
    s.subtract(M * C), !E && te(M) < d && (s.set(i.constrain(s.get())), o.useDuration(25).useBaseFriction());
  }
  function y(E) {
    p = !E;
  }
  return {
    shouldConstrain: g,
    constrain: v,
    toggleActive: y
  };
}
function ax(i, a, s, o, c) {
  const d = Ta(-a + i, 0), f = y(), h = v(), p = S();
  function g(A, w) {
    return Hs(A, w) <= 1;
  }
  function v() {
    const A = f[0], w = An(f), M = f.lastIndexOf(A), C = f.indexOf(w) + 1;
    return Ta(M, C);
  }
  function y() {
    return s.map((A, w) => {
      const {
        min: M,
        max: C
      } = d, N = d.constrain(A), H = !w, X = fh(s, w);
      return H ? C : X || g(M, N) ? M : g(C, N) ? C : N;
    }).map((A) => parseFloat(A.toFixed(3)));
  }
  function S() {
    if (a <= i + c) return [d.max];
    if (o === "keepSnaps") return f;
    const {
      min: A,
      max: w
    } = h;
    return f.slice(A, w);
  }
  return {
    snapsContained: p,
    scrollContainLimit: h
  };
}
function lx(i, a, s) {
  const o = a[0], c = s ? o - i : An(a);
  return {
    limit: Ta(c, o)
  };
}
function sx(i, a, s, o) {
  const d = a.min + 0.1, f = a.max + 0.1, {
    reachedMin: h,
    reachedMax: p
  } = Ta(d, f);
  function g(S) {
    return S === 1 ? p(s.get()) : S === -1 ? h(s.get()) : !1;
  }
  function v(S) {
    if (!g(S)) return;
    const E = i * (S * -1);
    o.forEach((A) => A.add(E));
  }
  return {
    loop: v
  };
}
function ox(i) {
  const {
    max: a,
    length: s
  } = i;
  function o(d) {
    const f = d - a;
    return s ? f / -s : 0;
  }
  return {
    get: o
  };
}
function rx(i, a, s, o, c) {
  const {
    startEdge: d,
    endEdge: f
  } = i, {
    groupSlides: h
  } = c, p = y().map(a.measure), g = S(), v = E();
  function y() {
    return h(o).map((w) => An(w)[f] - w[0][d]).map(te);
  }
  function S() {
    return o.map((w) => s[d] - w[d]).map((w) => -te(w));
  }
  function E() {
    return h(g).map((w) => w[0]).map((w, M) => w + p[M]);
  }
  return {
    snaps: g,
    snapsAligned: v
  };
}
function ux(i, a, s, o, c, d) {
  const {
    groupSlides: f
  } = c, {
    min: h,
    max: p
  } = o, g = v();
  function v() {
    const S = f(d), E = !i || a === "keepSnaps";
    return s.length === 1 ? [d] : E ? S : S.slice(h, p).map((A, w, M) => {
      const C = !w, N = fh(M, w);
      if (C) {
        const H = An(M[0]) + 1;
        return _0(H);
      }
      if (N) {
        const H = $s(d) - An(M)[0] + 1;
        return _0(H, An(M)[0]);
      }
      return A;
    });
  }
  return {
    slideRegistry: g
  };
}
function cx(i, a, s, o, c) {
  const {
    reachedAny: d,
    removeOffset: f,
    constrain: h
  } = o;
  function p(A) {
    return A.concat().sort((w, M) => te(w) - te(M))[0];
  }
  function g(A) {
    const w = i ? f(A) : h(A), M = a.map((N, H) => ({
      diff: v(N - w, 0),
      index: H
    })).sort((N, H) => te(N.diff) - te(H.diff)), {
      index: C
    } = M[0];
    return {
      index: C,
      distance: w
    };
  }
  function v(A, w) {
    const M = [A, A + s, A - s];
    if (!i) return A;
    if (!w) return p(M);
    const C = M.filter((N) => ch(N) === w);
    return C.length ? p(C) : An(M) - s;
  }
  function y(A, w) {
    const M = a[A] - c.get(), C = v(M, w);
    return {
      index: A,
      distance: C
    };
  }
  function S(A, w) {
    const M = c.get() + A, {
      index: C,
      distance: N
    } = g(M), H = !i && d(M);
    if (!w || H) return {
      index: C,
      distance: A
    };
    const X = a[C] - N, I = A + v(X, 0);
    return {
      index: C,
      distance: I
    };
  }
  return {
    byDistance: S,
    byIndex: y,
    shortcut: v
  };
}
function fx(i, a, s, o, c, d, f) {
  function h(y) {
    const S = y.distance, E = y.index !== a.get();
    d.add(S), S && (o.duration() ? i.start() : (i.update(), i.render(1), i.update())), E && (s.set(a.get()), a.set(y.index), f.emit("select"));
  }
  function p(y, S) {
    const E = c.byDistance(y, S);
    h(E);
  }
  function g(y, S) {
    const E = a.clone().set(y), A = c.byIndex(E.get(), S);
    h(A);
  }
  return {
    distance: p,
    index: g
  };
}
function dx(i, a, s, o, c, d, f, h) {
  const p = {
    passive: !0,
    capture: !0
  };
  let g = 0;
  function v(E) {
    if (!h) return;
    function A(w) {
      if ((/* @__PURE__ */ new Date()).getTime() - g > 10) return;
      f.emit("slideFocusStart"), i.scrollLeft = 0;
      const N = s.findIndex((H) => H.includes(w));
      uh(N) && (c.useDuration(0), o.index(N, 0), f.emit("slideFocus"));
    }
    d.add(document, "keydown", y, !1), a.forEach((w, M) => {
      d.add(w, "focus", (C) => {
        (fu(h) || h(E, C)) && A(M);
      }, p);
    });
  }
  function y(E) {
    E.code === "Tab" && (g = (/* @__PURE__ */ new Date()).getTime());
  }
  return {
    init: v
  };
}
function Us(i) {
  let a = i;
  function s() {
    return a;
  }
  function o(p) {
    a = f(p);
  }
  function c(p) {
    a += f(p);
  }
  function d(p) {
    a -= f(p);
  }
  function f(p) {
    return uh(p) ? p : p.get();
  }
  return {
    get: s,
    set: o,
    add: c,
    subtract: d
  };
}
function Ob(i, a) {
  const s = i.scroll === "x" ? f : h, o = a.style;
  let c = null, d = !1;
  function f(S) {
    return `translate3d(${S}px,0px,0px)`;
  }
  function h(S) {
    return `translate3d(0px,${S}px,0px)`;
  }
  function p(S) {
    if (d) return;
    const E = kA(i.direction(S));
    E !== c && (o.transform = s(E), c = E);
  }
  function g(S) {
    d = !S;
  }
  function v() {
    d || (o.transform = "", a.getAttribute("style") || a.removeAttribute("style"));
  }
  return {
    clear: v,
    to: p,
    toggleActive: g
  };
}
function hx(i, a, s, o, c, d, f, h, p) {
  const v = Ys(c), y = Ys(c).reverse(), S = C().concat(N());
  function E(z, D) {
    return z.reduce((at, lt) => at - c[lt], D);
  }
  function A(z, D) {
    return z.reduce((at, lt) => E(at, D) > 0 ? at.concat([lt]) : at, []);
  }
  function w(z) {
    return d.map((D, at) => ({
      start: D - o[at] + 0.5 + z,
      end: D + a - 0.5 + z
    }));
  }
  function M(z, D, at) {
    const lt = w(D);
    return z.map((st) => {
      const dt = at ? 0 : -s, vt = at ? s : 0, xt = at ? "end" : "start", St = lt[st][xt];
      return {
        index: st,
        loopPoint: St,
        slideLocation: Us(-1),
        translate: Ob(i, p[st]),
        target: () => h.get() > St ? dt : vt
      };
    });
  }
  function C() {
    const z = f[0], D = A(y, z);
    return M(D, s, !1);
  }
  function N() {
    const z = a - f[0] - 1, D = A(v, z);
    return M(D, -s, !0);
  }
  function H() {
    return S.every(({
      index: z
    }) => {
      const D = v.filter((at) => at !== z);
      return E(D, a) <= 0.1;
    });
  }
  function X() {
    S.forEach((z) => {
      const {
        target: D,
        translate: at,
        slideLocation: lt
      } = z, st = D();
      st !== lt.get() && (at.to(st), lt.set(st));
    });
  }
  function I() {
    S.forEach((z) => z.translate.clear());
  }
  return {
    canLoop: H,
    clear: I,
    loop: X,
    loopPoints: S
  };
}
function mx(i, a, s) {
  let o, c = !1;
  function d(p) {
    if (!s) return;
    function g(v) {
      for (const y of v)
        if (y.type === "childList") {
          p.reInit(), a.emit("slidesChanged");
          break;
        }
    }
    o = new MutationObserver((v) => {
      c || (fu(s) || s(p, v)) && g(v);
    }), o.observe(i, {
      childList: !0
    });
  }
  function f() {
    o && o.disconnect(), c = !0;
  }
  return {
    init: d,
    destroy: f
  };
}
function px(i, a, s, o) {
  const c = {};
  let d = null, f = null, h, p = !1;
  function g() {
    h = new IntersectionObserver((A) => {
      p || (A.forEach((w) => {
        const M = a.indexOf(w.target);
        c[M] = w;
      }), d = null, f = null, s.emit("slidesInView"));
    }, {
      root: i.parentElement,
      threshold: o
    }), a.forEach((A) => h.observe(A));
  }
  function v() {
    h && h.disconnect(), p = !0;
  }
  function y(A) {
    return qs(c).reduce((w, M) => {
      const C = parseInt(M), {
        isIntersecting: N
      } = c[C];
      return (A && N || !A && !N) && w.push(C), w;
    }, []);
  }
  function S(A = !0) {
    if (A && d) return d;
    if (!A && f) return f;
    const w = y(A);
    return A && (d = w), A || (f = w), w;
  }
  return {
    init: g,
    destroy: v,
    get: S
  };
}
function gx(i, a, s, o, c, d) {
  const {
    measureSize: f,
    startEdge: h,
    endEdge: p
  } = i, g = s[0] && c, v = A(), y = w(), S = s.map(f), E = M();
  function A() {
    if (!g) return 0;
    const N = s[0];
    return te(a[h] - N[h]);
  }
  function w() {
    if (!g) return 0;
    const N = d.getComputedStyle(An(o));
    return parseFloat(N.getPropertyValue(`margin-${p}`));
  }
  function M() {
    return s.map((N, H, X) => {
      const I = !H, et = fh(X, H);
      return I ? S[H] + v : et ? S[H] + y : X[H + 1][h] - N[h];
    }).map(te);
  }
  return {
    slideSizes: S,
    slideSizesWithGaps: E,
    startGap: v,
    endGap: y
  };
}
function yx(i, a, s, o, c, d, f, h, p) {
  const {
    startEdge: g,
    endEdge: v,
    direction: y
  } = i, S = uh(s);
  function E(C, N) {
    return Ys(C).filter((H) => H % N === 0).map((H) => C.slice(H, H + N));
  }
  function A(C) {
    return C.length ? Ys(C).reduce((N, H, X) => {
      const I = An(N) || 0, et = I === 0, z = H === $s(C), D = c[g] - d[I][g], at = c[g] - d[H][v], lt = !o && et ? y(f) : 0, st = !o && z ? y(h) : 0, dt = te(at - st - (D + lt));
      return X && dt > a + p && N.push(H), z && N.push(C.length), N;
    }, []).map((N, H, X) => {
      const I = Math.max(X[H - 1] || 0);
      return C.slice(I, N);
    }) : [];
  }
  function w(C) {
    return S ? E(C, s) : A(C);
  }
  return {
    groupSlides: w
  };
}
function vx(i, a, s, o, c, d, f) {
  const {
    align: h,
    axis: p,
    direction: g,
    startIndex: v,
    loop: y,
    duration: S,
    dragFree: E,
    dragThreshold: A,
    inViewThreshold: w,
    slidesToScroll: M,
    skipSnaps: C,
    containScroll: N,
    watchResize: H,
    watchSlides: X,
    watchDrag: I,
    watchFocus: et
  } = d, z = 2, D = $A(), at = D.measure(a), lt = s.map(D.measure), st = FA(p, g), dt = st.measureSize(at), vt = tx(dt), xt = PA(h, dt), St = !y && !!N, F = y || !!N, {
    slideSizes: rt,
    slideSizesWithGaps: ut,
    startGap: nt,
    endGap: L
  } = gx(st, at, lt, s, F, c), K = yx(st, dt, M, y, at, lt, nt, L, z), {
    snaps: $,
    snapsAligned: tt
  } = rx(st, xt, at, lt, K), T = -An($) + An(ut), {
    snapsContained: U,
    scrollContainLimit: k
  } = ax(dt, T, tt, N, z), J = St ? U : tt, {
    limit: it
  } = lx(T, J, y), W = Db($s(J), v, y), ft = W.clone(), P = Ys(s), G = ({
    dragHandler: wn,
    scrollBody: Xi,
    scrollBounds: zl,
    options: {
      loop: Qi
    }
  }) => {
    Qi || zl.constrain(wn.pointerDown()), Xi.seek();
  }, ct = ({
    scrollBody: wn,
    translate: Xi,
    location: zl,
    offsetLocation: Qi,
    previousLocation: Rl,
    scrollLooper: Nl,
    slideLooper: _l,
    dragHandler: Su,
    animation: Tu,
    eventHandler: we,
    scrollBounds: Eu,
    options: {
      loop: Vl
    }
  }, Ll) => {
    const Zi = wn.settled(), Au = !Eu.shouldConstrain(), Ul = Vl ? Zi : Zi && Au, io = Ul && !Su.pointerDown();
    io && Tu.stop();
    const xu = zl.get() * Ll + Rl.get() * (1 - Ll);
    Qi.set(xu), Vl && (Nl.loop(wn.direction()), _l.loop()), Xi.to(Qi.get()), io && we.emit("settle"), Ul || we.emit("scroll");
  }, Tt = JA(o, c, () => G(en), (wn) => ct(en, wn)), Xt = 0.68, Ht = J[W.get()], Ut = Us(Ht), Mt = Us(Ht), ie = Us(Ht), qe = Us(Ht), Ve = nx(Ut, ie, Mt, qe, S, Xt), oi = cx(y, J, T, it, qe), ri = fx(Tt, W, ft, Ve, oi, qe, f), Yn = ox(it), wa = Xs(), Ca = px(a, s, f, w), {
    slideRegistry: Da
  } = ux(St, N, J, k, K, P), no = dx(i, s, Da, ri, Ve, wa, f, et), en = {
    ownerDocument: o,
    ownerWindow: c,
    eventHandler: f,
    containerRect: at,
    slideRects: lt,
    animation: Tt,
    axis: st,
    dragHandler: IA(st, i, o, c, qe, WA(st, c), Ut, Tt, ri, Ve, oi, W, f, vt, E, A, C, Xt, I),
    eventStore: wa,
    percentOfView: vt,
    index: W,
    indexPrevious: ft,
    limit: it,
    location: Ut,
    offsetLocation: ie,
    previousLocation: Mt,
    options: d,
    resizeHandler: ex(a, f, c, s, st, H, D),
    scrollBody: Ve,
    scrollBounds: ix(it, ie, qe, Ve, vt),
    scrollLooper: sx(T, it, ie, [Ut, ie, Mt, qe]),
    scrollProgress: Yn,
    scrollSnapList: J.map(Yn.get),
    scrollSnaps: J,
    scrollTarget: oi,
    scrollTo: ri,
    slideLooper: hx(st, dt, T, rt, ut, $, J, ie, s),
    slideFocus: no,
    slidesHandler: mx(a, f, X),
    slidesInView: Ca,
    slideIndexes: P,
    slideRegistry: Da,
    slidesToScroll: K,
    target: qe,
    translate: Ob(st, a)
  };
  return en;
}
function bx() {
  let i = {}, a;
  function s(g) {
    a = g;
  }
  function o(g) {
    return i[g] || [];
  }
  function c(g) {
    return o(g).forEach((v) => v(a, g)), p;
  }
  function d(g, v) {
    return i[g] = o(g).concat([v]), p;
  }
  function f(g, v) {
    return i[g] = o(g).filter((y) => y !== v), p;
  }
  function h() {
    i = {};
  }
  const p = {
    init: s,
    emit: c,
    off: f,
    on: d,
    clear: h
  };
  return p;
}
const Sx = {
  align: "center",
  axis: "x",
  container: null,
  slides: null,
  containScroll: "trimSnaps",
  direction: "ltr",
  slidesToScroll: 1,
  inViewThreshold: 0,
  breakpoints: {},
  dragFree: !1,
  dragThreshold: 10,
  loop: !1,
  skipSnaps: !1,
  duration: 25,
  startIndex: 0,
  active: !0,
  watchDrag: !0,
  watchResize: !0,
  watchSlides: !0,
  watchFocus: !0
};
function Tx(i) {
  function a(d, f) {
    return Cb(d, f || {});
  }
  function s(d) {
    const f = d.breakpoints || {}, h = qs(f).filter((p) => i.matchMedia(p).matches).map((p) => f[p]).reduce((p, g) => a(p, g), {});
    return a(d, h);
  }
  function o(d) {
    return d.map((f) => qs(f.breakpoints || {})).reduce((f, h) => f.concat(h), []).map(i.matchMedia);
  }
  return {
    mergeOptions: a,
    optionsAtMedia: s,
    optionsMediaQueries: o
  };
}
function Ex(i) {
  let a = [];
  function s(d, f) {
    return a = f.filter(({
      options: h
    }) => i.optionsAtMedia(h).active !== !1), a.forEach((h) => h.init(d, i)), f.reduce((h, p) => Object.assign(h, {
      [p.name]: p
    }), {});
  }
  function o() {
    a = a.filter((d) => d.destroy());
  }
  return {
    init: s,
    destroy: o
  };
}
function Kr(i, a, s) {
  const o = i.ownerDocument, c = o.defaultView, d = Tx(c), f = Ex(d), h = Xs(), p = bx(), {
    mergeOptions: g,
    optionsAtMedia: v,
    optionsMediaQueries: y
  } = d, {
    on: S,
    off: E,
    emit: A
  } = p, w = st;
  let M = !1, C, N = g(Sx, Kr.globalOptions), H = g(N), X = [], I, et, z;
  function D() {
    const {
      container: P,
      slides: G
    } = H;
    et = (Od(P) ? i.querySelector(P) : P) || i.children[0];
    const Tt = Od(G) ? et.querySelectorAll(G) : G;
    z = [].slice.call(Tt || et.children);
  }
  function at(P) {
    const G = vx(i, et, z, o, c, P, p);
    if (P.loop && !G.slideLooper.canLoop()) {
      const ct = Object.assign({}, P, {
        loop: !1
      });
      return at(ct);
    }
    return G;
  }
  function lt(P, G) {
    M || (N = g(N, P), H = v(N), X = G || X, D(), C = at(H), y([N, ...X.map(({
      options: ct
    }) => ct)]).forEach((ct) => h.add(ct, "change", st)), H.active && (C.translate.to(C.location.get()), C.animation.init(), C.slidesInView.init(), C.slideFocus.init(ft), C.eventHandler.init(ft), C.resizeHandler.init(ft), C.slidesHandler.init(ft), C.options.loop && C.slideLooper.loop(), et.offsetParent && z.length && C.dragHandler.init(ft), I = f.init(ft, X)));
  }
  function st(P, G) {
    const ct = K();
    dt(), lt(g({
      startIndex: ct
    }, P), G), p.emit("reInit");
  }
  function dt() {
    C.dragHandler.destroy(), C.eventStore.clear(), C.translate.clear(), C.slideLooper.clear(), C.resizeHandler.destroy(), C.slidesHandler.destroy(), C.slidesInView.destroy(), C.animation.destroy(), f.destroy(), h.clear();
  }
  function vt() {
    M || (M = !0, h.clear(), dt(), p.emit("destroy"), p.clear());
  }
  function xt(P, G, ct) {
    !H.active || M || (C.scrollBody.useBaseFriction().useDuration(G === !0 ? 0 : H.duration), C.scrollTo.index(P, ct || 0));
  }
  function St(P) {
    const G = C.index.add(1).get();
    xt(G, P, -1);
  }
  function F(P) {
    const G = C.index.add(-1).get();
    xt(G, P, 1);
  }
  function rt() {
    return C.index.add(1).get() !== K();
  }
  function ut() {
    return C.index.add(-1).get() !== K();
  }
  function nt() {
    return C.scrollSnapList;
  }
  function L() {
    return C.scrollProgress.get(C.offsetLocation.get());
  }
  function K() {
    return C.index.get();
  }
  function $() {
    return C.indexPrevious.get();
  }
  function tt() {
    return C.slidesInView.get();
  }
  function T() {
    return C.slidesInView.get(!1);
  }
  function U() {
    return I;
  }
  function k() {
    return C;
  }
  function J() {
    return i;
  }
  function it() {
    return et;
  }
  function W() {
    return z;
  }
  const ft = {
    canScrollNext: rt,
    canScrollPrev: ut,
    containerNode: it,
    internalEngine: k,
    destroy: vt,
    off: E,
    on: S,
    emit: A,
    plugins: U,
    previousScrollSnap: $,
    reInit: w,
    rootNode: J,
    scrollNext: St,
    scrollPrev: F,
    scrollProgress: L,
    scrollSnapList: nt,
    scrollTo: xt,
    selectedScrollSnap: K,
    slideNodes: W,
    slidesInView: tt,
    slidesNotInView: T
  };
  return lt(a, s), setTimeout(() => p.emit("init"), 0), ft;
}
Kr.globalOptions = void 0;
function dh(i = {}, a = []) {
  const s = q.useRef(i), o = q.useRef(a), [c, d] = q.useState(), [f, h] = q.useState(), p = q.useCallback(() => {
    c && c.reInit(s.current, o.current);
  }, [c]);
  return q.useEffect(() => {
    rh(s.current, i) || (s.current = i, p());
  }, [i, p]), q.useEffect(() => {
    ZA(o.current, a) || (o.current = a, p());
  }, [a, p]), q.useEffect(() => {
    if (QA() && f) {
      Kr.globalOptions = dh.globalOptions;
      const g = Kr(f, s.current, o.current);
      return d(g), () => g.destroy();
    } else
      d(void 0);
  }, [f, d]), [h, c];
}
dh.globalOptions = void 0;
var ld = { exports: {} }, Rs = {};
/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var V0;
function Ax() {
  if (V0) return Rs;
  V0 = 1;
  var i = Symbol.for("react.transitional.element"), a = Symbol.for("react.fragment");
  function s(o, c, d) {
    var f = null;
    if (d !== void 0 && (f = "" + d), c.key !== void 0 && (f = "" + c.key), "key" in c) {
      d = {};
      for (var h in c)
        h !== "key" && (d[h] = c[h]);
    } else d = c;
    return c = d.ref, {
      $$typeof: i,
      type: o,
      key: f,
      ref: c !== void 0 ? c : null,
      props: d
    };
  }
  return Rs.Fragment = a, Rs.jsx = s, Rs.jsxs = s, Rs;
}
var L0;
function xx() {
  return L0 || (L0 = 1, ld.exports = Ax()), ld.exports;
}
var kr = xx();
const zb = /* @__PURE__ */ q.createContext({});
function hh(i) {
  const a = q.useRef(null);
  return a.current === null && (a.current = i()), a.current;
}
const Mx = typeof window < "u", Rd = Mx ? q.useLayoutEffect : q.useEffect, mh = /* @__PURE__ */ q.createContext(null);
function ph(i, a) {
  i.indexOf(a) === -1 && i.push(a);
}
function Pr(i, a) {
  const s = i.indexOf(a);
  s > -1 && i.splice(s, 1);
}
const Gn = (i, a, s) => s > a ? a : s < i ? i : s, Mn = {}, gh = (i) => /^-?(?:\d+(?:\.\d+)?|\.\d+)$/u.test(i), Rb = (i) => typeof i == "object" && i !== null, yh = (i) => /^0[^.\s]+$/u.test(i);
// @__NO_SIDE_EFFECTS__
function wx(i) {
  let a;
  return () => (a === void 0 && (a = i()), a);
}
const xn = /* @__NO_SIDE_EFFECTS__ */ (i) => i, Ml = (...i) => i.reduce((a, s) => (o) => s(a(o))), Ea = /* @__NO_SIDE_EFFECTS__ */ (i, a, s) => {
  const o = a - i;
  return o ? (s - i) / o : 1;
};
class Jr {
  constructor() {
    this.subscriptions = [];
  }
  add(a) {
    return ph(this.subscriptions, a), () => this.remove(a);
  }
  remove(a) {
    Pr(this.subscriptions, a);
  }
  notify(a, s, o) {
    const c = this.subscriptions.length;
    if (c)
      if (c === 1)
        this.subscriptions[0](a, s, o);
      else
        for (let d = 0; d < c; d++) {
          const f = this.subscriptions[d];
          f && f(a, s, o);
        }
  }
  getSize() {
    return this.subscriptions.length;
  }
  clear() {
    this.subscriptions.length = 0;
  }
}
const Oe = /* @__NO_SIDE_EFFECTS__ */ (i) => i * 1e3, $e = /* @__NO_SIDE_EFFECTS__ */ (i) => i / 1e3, Nb = /* @__NO_SIDE_EFFECTS__ */ (i, a) => a ? i * (1e3 / a) : 0, sd = (i, a, s) => i * (3 * (1 - i) * ((1 - i) * a + i * s) + i * i);
// @__NO_SIDE_EFFECTS__
function to(i, a, s, o) {
  return i === a && s === o ? xn : (c) => {
    let d = 0, f = 1, h = c;
    for (let p = 0; ; p++) {
      h >= d && h <= f || (h = (d + f) / 2);
      const g = sd(h, i, s) - c;
      if (g * g < 1e-28 || p === 40)
        break;
      g > 0 ? f = h : d = h, h -= g * 1e-7 / (sd(h + 1e-7, i, s) - c - g);
    }
    return sd(h, a, o);
  };
}
const _b = /* @__NO_SIDE_EFFECTS__ */ (i) => (a) => a <= 0.5 ? i(2 * a) / 2 : (2 - i(2 * (1 - a))) / 2, Vb = /* @__NO_SIDE_EFFECTS__ */ (i) => (a) => 1 - i(1 - a), Lb = /* @__PURE__ */ to(0.33, 1.53, 0.69, 0.99), vh = /* @__PURE__ */ Vb(Lb), Ub = /* @__PURE__ */ _b(vh), Bb = (i) => i >= 1 ? 1 : (i *= 2) < 1 ? 0.5 * vh(i) : 0.5 * (2 - Math.pow(2, -10 * (i - 1))), bh = (i) => 1 - Math.sin(Math.acos(i)), Hb = /* @__PURE__ */ Vb(bh), jb = /* @__PURE__ */ _b(bh), Cx = /* @__PURE__ */ to(0.42, 0, 1, 1), Dx = /* @__PURE__ */ to(0, 0, 0.58, 1), Sh = /* @__PURE__ */ to(0.42, 0, 0.58, 1), Gb = /* @__NO_SIDE_EFFECTS__ */ (i) => Array.isArray(i) && typeof i[0] != "number", Th = /* @__NO_SIDE_EFFECTS__ */ (i) => Array.isArray(i) && typeof i[0] == "number", Ox = {
  linear: xn,
  easeIn: Cx,
  easeInOut: Sh,
  easeOut: Dx,
  circIn: bh,
  circInOut: jb,
  circOut: Hb,
  backIn: vh,
  backInOut: Ub,
  backOut: Lb,
  anticipate: Bb
}, zx = (i) => typeof i == "string", Nd = (i) => {
  if (/* @__PURE__ */ Th(i)) {
    const [a, s, o, c] = i;
    return /* @__PURE__ */ to(a, s, o, c);
  } else if (zx(i))
    return Ox[i];
  return i;
}, le = {
  delta: 0,
  timestamp: 0,
  isProcessing: !1
};
let Br;
function Rx() {
  Br = void 0;
}
const Gt = {
  now: () => (Br === void 0 && Gt.set(le.isProcessing || Mn.useManualTiming ? le.timestamp : performance.now()), Br),
  set: (i) => {
    Br = i, queueMicrotask(Rx);
  }
}, xl = (i) => Math.round(i * 1e5) / 1e5, Yb = (i) => (a) => typeof a == "string" && a.startsWith(i), qb = /* @__PURE__ */ Yb("--"), Nx = /* @__PURE__ */ Yb("var(--"), du = (i) => Nx(i) ? _x.test(i.split("/*")[0].trim()) : !1, _x = /var\(--(?:[\w-]+\s*|[\w-]+\s*,(?:\s*[^)(\s]|\s*\((?:[^)(]|\([^)(]*\))*\))+\s*)\)$/iu;
function od(i) {
  return typeof i != "string" ? !1 : i.split("/*")[0].includes("var(--");
}
const Ol = {
  test: (i) => typeof i == "number",
  parse: parseFloat,
  transform: (i) => i
}, Qs = {
  ...Ol,
  transform: (i) => Gn(0, 1, i)
}, Rr = {
  ...Ol,
  default: 1
}, Eh = /-?(?:\d+(?:\.\d+)?|\.\d+)/gu;
function Vx(i) {
  return i == null;
}
const Lx = /^(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\))$/iu, Ah = (i, a) => (s) => !!(typeof s == "string" && Lx.test(s) && s.startsWith(i) || a && !Vx(s) && Object.prototype.hasOwnProperty.call(s, a)), Xb = (i, a, s) => (o) => {
  if (typeof o != "string")
    return o;
  const [c, d, f, h] = o.match(Eh);
  return {
    [i]: parseFloat(c),
    [a]: parseFloat(d),
    [s]: parseFloat(f),
    alpha: h !== void 0 ? parseFloat(h) : 1
  };
}, Ux = (i) => Gn(0, 255, i), rd = {
  ...Ol,
  transform: (i) => Math.round(Ux(i))
}, ya = {
  test: /* @__PURE__ */ Ah("rgb", "red"),
  parse: /* @__PURE__ */ Xb("red", "green", "blue"),
  transform: ({ red: i, green: a, blue: s, alpha: o = 1 }) => "rgba(" + rd.transform(i) + ", " + rd.transform(a) + ", " + rd.transform(s) + ", " + xl(Qs.transform(o)) + ")"
}, Nr = (i, a, s) => {
  const o = i.substring(1 + a * s, 1 + (a + 1) * s);
  return s > 1 ? o : o + o;
};
function Bx(i) {
  const a = i.length > 5 ? 2 : 1, s = Nr(i, 3, a);
  return {
    red: parseInt(Nr(i, 0, a), 16),
    green: parseInt(Nr(i, 1, a), 16),
    blue: parseInt(Nr(i, 2, a), 16),
    alpha: s ? parseInt(s, 16) / 255 : 1
  };
}
const _d = {
  test: /* @__PURE__ */ Ah("#"),
  parse: Bx,
  transform: ya.transform
}, eo = /* @__NO_SIDE_EFFECTS__ */ (i) => ({
  test: (a) => typeof a == "string" && a.endsWith(i) && a.split(" ").length === 1,
  parse: parseFloat,
  transform: (a) => `${a}${i}`
}), ai = /* @__PURE__ */ eo("deg"), jn = /* @__PURE__ */ eo("%"), gt = /* @__PURE__ */ eo("px"), Hx = /* @__PURE__ */ eo("vh"), jx = /* @__PURE__ */ eo("vw"), U0 = {
  ...jn,
  parse: (i) => jn.parse(i) / 100,
  transform: (i) => jn.transform(i * 100)
}, bl = {
  test: /* @__PURE__ */ Ah("hsl", "hue"),
  parse: /* @__PURE__ */ Xb("hue", "saturation", "lightness"),
  transform: ({ hue: i, saturation: a, lightness: s, alpha: o = 1 }) => "hsla(" + Math.round(i) + ", " + jn.transform(xl(a)) + ", " + jn.transform(xl(s)) + ", " + xl(Qs.transform(o)) + ")"
}, he = {
  test: (i) => ya.test(i) || _d.test(i) || bl.test(i),
  parse: (i) => ya.test(i) ? ya.parse(i) : bl.test(i) ? bl.parse(i) : _d.parse(i),
  transform: (i) => typeof i == "string" ? i : i.hasOwnProperty("red") ? ya.transform(i) : bl.transform(i),
  getAnimatableNone: (i) => {
    const a = he.parse(i);
    return a.alpha = 0, he.transform(a);
  }
}, Gx = /(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\))/giu, Qb = /* @__PURE__ */ new RegExp(Eh.source), Zb = /* @__PURE__ */ new RegExp(Gx.source, "i");
function Yx(i) {
  return isNaN(i) && typeof i == "string" && (Qb.test(i) || Zb.test(i));
}
const Kb = "number", kb = "color", qx = "var", Xx = "var(", B0 = "${}", Qx = /var\s*\(\s*--(?:[\w-]+\s*|[\w-]+\s*,(?:\s*[^)(\s]|\s*\((?:[^)(]|\([^)(]*\))*\))+\s*)\)|#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\)|-?(?:\d+(?:\.\d+)?|\.\d+)(?![a-z]*\()/giu;
function Zx(i) {
  const a = i.toString();
  return Qb.test(a) || Zb.test(a);
}
function Zs(i) {
  const a = i.toString(), s = [], o = {
    color: [],
    number: [],
    var: []
  }, c = [];
  let d = 0;
  const h = a.replace(Qx, (p) => (he.test(p) ? (o.color.push(d), c.push(kb), s.push(he.parse(p))) : p.startsWith(Xx) ? (o.var.push(d), c.push(qx), s.push(p)) : (o.number.push(d), c.push(Kb), s.push(parseFloat(p))), ++d, B0)).split(B0);
  return { values: s, split: h, indexes: o, types: c };
}
function Kx(i) {
  return Zs(i).values;
}
function xh({ split: i, types: a }) {
  const s = i.length;
  return (o) => {
    let c = "";
    for (let d = 0; d < s; d++)
      if (c += i[d], o[d] !== void 0) {
        const f = a[d];
        f === Kb ? c += xl(o[d]) : f === kb ? c += he.transform(o[d]) : c += o[d];
      }
    return c;
  };
}
function kx(i) {
  return xh(Zs(i));
}
const Px = (i) => typeof i == "number" ? 0 : he.test(i) ? he.getAnimatableNone(i) : i, Jx = (i, a) => typeof i == "number" ? a != null && a.trim().endsWith("/") ? i : 0 : Px(i);
function Fx(i) {
  const a = Zs(i);
  return xh(a)(a.values.map((o, c) => Jx(o, a.split[c])));
}
const dn = {
  test: Yx,
  parse: Kx,
  createTransformer: kx,
  getAnimatableNone: Fx
};
function ud(i, a, s) {
  return s < 0 && (s += 1), s > 1 && (s -= 1), s < 1 / 6 ? i + (a - i) * 6 * s : s < 1 / 2 ? a : s < 2 / 3 ? i + (a - i) * (2 / 3 - s) * 6 : i;
}
function Ix({ hue: i, saturation: a, lightness: s, alpha: o }) {
  i /= 360, a /= 100, s /= 100;
  let c = 0, d = 0, f = 0;
  if (!a)
    c = d = f = s;
  else {
    const h = s < 0.5 ? s * (1 + a) : s + a - s * a, p = 2 * s - h;
    c = ud(p, h, i + 1 / 3), d = ud(p, h, i), f = ud(p, h, i - 1 / 3);
  }
  return {
    red: Math.round(c * 255),
    green: Math.round(d * 255),
    blue: Math.round(f * 255),
    alpha: o
  };
}
function Fr(i, a) {
  return (s) => s > 0 ? a : i;
}
const Jt = (i, a, s) => i + (a - i) * s, cd = (i, a, s) => {
  const o = i * i, c = s * (a * a - o) + o;
  return c < 0 ? 0 : Math.sqrt(c);
}, Wx = [_d, ya, bl], $x = (i) => Wx.find((a) => a.test(i));
function H0(i) {
  const a = $x(i);
  if (!a)
    return !1;
  let s = a.parse(i);
  return a === bl && (s = Ix(s)), s;
}
const j0 = (i, a) => {
  const s = H0(i), o = H0(a);
  if (!s || !o)
    return Fr(i, a);
  const c = { ...s };
  return (d) => (c.red = cd(s.red, o.red, d), c.green = cd(s.green, o.green, d), c.blue = cd(s.blue, o.blue, d), c.alpha = Jt(s.alpha, o.alpha, d), ya.transform(c));
}, Vd = /* @__PURE__ */ new Set(["none", "hidden"]);
function tM(i, a) {
  return Vd.has(i) ? (s) => s <= 0 ? i : a : (s) => s >= 1 ? a : i;
}
function eM(i, a) {
  return (s) => Jt(i, a, s);
}
function Mh(i) {
  return typeof i == "number" ? eM : typeof i == "string" ? du(i) ? Fr : he.test(i) ? j0 : aM : Array.isArray(i) ? Pb : typeof i == "object" ? he.test(i) ? j0 : nM : Fr;
}
function Pb(i, a) {
  const s = [...i], o = s.length, c = i.map((d, f) => Mh(d)(d, a[f]));
  return (d) => {
    for (let f = 0; f < o; f++)
      s[f] = c[f](d);
    return s;
  };
}
function nM(i, a) {
  const s = { ...i, ...a }, o = {};
  for (const c in s)
    i[c] !== void 0 && a[c] !== void 0 && (o[c] = Mh(i[c])(i[c], a[c]));
  return (c) => {
    for (const d in o)
      s[d] = o[d](c);
    return s;
  };
}
function iM(i, a) {
  const s = [], o = { color: 0, var: 0, number: 0 };
  for (let c = 0; c < a.values.length; c++) {
    const d = a.types[c], f = i.indexes[d][o[d]], h = i.values[f] ?? 0;
    s[c] = h, o[d]++;
  }
  return s;
}
const aM = (i, a) => {
  const s = Zs(i), o = Zs(a);
  return s.indexes.var.length === o.indexes.var.length && s.indexes.color.length === o.indexes.color.length && s.indexes.number.length >= o.indexes.number.length ? Vd.has(i) && !o.values.length || Vd.has(a) && !s.values.length ? tM(i, a) : Ml(Pb(iM(s, o), o.values), xh(o)) : Fr(i, a);
}, G0 = /^(-?(?:\d+(?:\.\d*)?|\.\d+))([a-z%]*)$/iu;
function lM(i, a) {
  const s = G0.exec(i);
  if (!s)
    return;
  const o = G0.exec(a);
  if (!o || s[2] !== o[2])
    return;
  const c = s[2], d = parseFloat(s[1]), f = parseFloat(o[1]);
  return (h) => xl(Jt(d, f, h)) + c;
}
function wh(i, a, s) {
  if (typeof i == "number" && typeof a == "number" && typeof s == "number")
    return Jt(i, a, s);
  if (typeof i == "string" && typeof a == "string") {
    const c = lM(i, a);
    if (c)
      return c;
  }
  return Mh(i)(i, a);
}
const _r = [
  "setup",
  // Compute
  "read",
  // Read
  "resolveKeyframes",
  // Write/Read/Write/Read
  "preUpdate",
  // Compute
  "update",
  // Compute
  "preRender",
  // Compute
  "render",
  // Write
  "postRender"
  // Compute
];
function sM(i) {
  let a = /* @__PURE__ */ new Set(), s = /* @__PURE__ */ new Set(), o = !1, c = !1, d;
  const f = /* @__PURE__ */ new Set();
  let h = {
    delta: 0,
    timestamp: 0,
    isProcessing: !1
  };
  function p(v) {
    f.has(v) && (s.add(v), i()), (d = v)(h);
  }
  const g = {
    /**
     * Schedule a process to run on the next frame.
     */
    schedule: (v, y = !1, S = !1) => {
      const E = S && o, A = E ? a : s;
      return y && f.add(v), E && v !== d && A.delete(v), A.add(v), v;
    },
    /**
     * Cancel the provided callback from running on the next frame.
     */
    cancel: (v) => {
      s.delete(v), f.delete(v);
    },
    /**
     * Execute all schedule callbacks.
     */
    process: (v) => {
      if (h = v, o) {
        c = !0;
        return;
      }
      o = !0;
      const y = a;
      a = s, s = y, a.forEach(p), a.clear(), d = void 0, o = !1, c && (c = !1, g.process(v));
    }
  };
  return g;
}
const oM = 40;
function Jb(i, a, s = {
  delta: 0,
  timestamp: 0,
  isProcessing: !1
}) {
  let o = !1, c = !0;
  const d = () => o = !0, f = _r.reduce((H, X) => (H[X] = sM(d), H), {}), { setup: h, read: p, resolveKeyframes: g, preUpdate: v, update: y, preRender: S, render: E, postRender: A } = f, w = () => {
    const H = Mn.useManualTiming, X = H ? s.timestamp : performance.now();
    o = !1, H || (s.delta = c ? 1e3 / 60 : Math.max(Math.min(X - s.timestamp, oM), 1)), s.timestamp = X, s.isProcessing = !0, h.process(s), p.process(s), g.process(s), v.process(s), y.process(s), S.process(s), E.process(s), A.process(s), s.isProcessing = !1, o && a && (c = !1, i(w));
  }, M = () => {
    o = !0, c = !0, s.isProcessing || i(w);
  };
  return { schedule: _r.reduce((H, X) => {
    const I = f[X];
    return H[X] = (et, z = !1, D = !1) => (o || M(), I.schedule(et, z, D)), H;
  }, {}), cancel: (H) => {
    for (let X = 0; X < _r.length; X++)
      f[_r[X]].cancel(H);
  }, state: s, steps: f };
}
const { schedule: qt, cancel: Ye, steps: fd } = /* @__PURE__ */ Jb(typeof requestAnimationFrame < "u" ? requestAnimationFrame : xn, !0, le), Ch = (i) => {
  const a = ({ timestamp: s }) => i(s);
  return {
    start: (s = !0) => qt.update(a, s),
    stop: () => Ye(a),
    /**
     * If we're processing this frame we can use the
     * framelocked timestamp to keep things in sync.
     */
    now: () => le.isProcessing ? le.timestamp : Gt.now()
  };
}, Fb = (i, a, s = 10) => {
  let o = "";
  const c = Math.max(Math.round(a / s), 2);
  for (let d = 0; d < c; d++)
    o += Math.round(i(d / (c - 1)) * 1e4) / 1e4 + ", ";
  return `linear(${o.substring(0, o.length - 2)})`;
}, Dh = 2e4;
function hu(i, a = 50, s = Dh, o) {
  let c = 0, d = i.next(c);
  for (; !d.done && c < s; )
    c += a, d = i.next(c);
  return c >= s ? 1 / 0 : c;
}
function rM(i, a = 100, s) {
  const { keyframes: o, velocity: c } = i, d = o && o[o.length - 1] - o[0], f = s({
    ...i,
    velocity: c && d ? c * a / d : c,
    keyframes: [0, a]
  }), h = Math.min(hu(f), Dh);
  return {
    type: "keyframes",
    ease: (p) => f.next(h * p).value / a,
    duration: /* @__PURE__ */ $e(h)
  };
}
const Y0 = 100, q0 = 10, uM = 1, cM = 800, Ib = 0.3, fM = 0.3, dM = 0.01, hM = 2, mM = 5e-3, pM = 0.5, gM = 0.01, yM = 10, X0 = 0.05, Wb = (i) => i < 0 ? 1 / Math.max(1 + i, X0) : Math.max(1 - i, X0);
function $b(i, a) {
  if (!(i > 1))
    return 1;
  const s = Math.sqrt(i * i - 1), o = i - s, c = i + s, d = 2 * s * Math.exp(-a) * (1 + a);
  return t1((f) => c * Math.exp(-o * f) - o * Math.exp(-c * f) - d, (f) => Math.exp(-c * f) - Math.exp(-o * f), a) / a;
}
function Ld(i, a) {
  return i * Math.sqrt(1 - a * a);
}
const vM = 12;
function t1(i, a, s) {
  let o = s;
  for (let c = 1; c < vM; c++)
    o = o - i(o) / a(o);
  return o;
}
const dd = 1e-3;
function bM({ duration: i = cM, bounce: a = Ib }) {
  let s, o;
  const c = Wb(a);
  i = Gn(gM, yM, /* @__PURE__ */ $e(i)), c < 1 ? (s = (g) => {
    const v = g * c, y = v * i, S = Ld(g, c), E = Math.exp(-y);
    return dd - v / S * E;
  }, o = (g) => {
    const y = g * c * i, S = c * c * g * g * i, E = Math.exp(-y), A = Ld(g * g, c);
    return (-s(g) + dd > 0 ? -1 : 1) * -S * E / A;
  }) : (s = (g) => {
    const v = Math.exp(-g * i), y = g * i + 1;
    return -dd + v * y;
  }, o = (g) => {
    const v = Math.exp(-g * i), y = -g * (i * i);
    return v * y;
  });
  const d = 5 / i, f = t1(s, o, d), h = f * $b(c, f * i), p = h * h;
  return {
    stiffness: p,
    damping: c * 2 * Math.sqrt(p),
    duration: /* @__PURE__ */ Oe(i)
  };
}
const Ud = (i, a) => (a ? i >= 0 : i > 0) && i < 1 / 0;
function hd(i, a) {
  if (Ud(i, a))
    return i;
}
function e1(i) {
  const a = hd(i.stiffness), s = hd(i.damping, !0), o = hd(i.mass), c = {
    ...i,
    stiffness: a ?? Y0,
    damping: s ?? q0,
    mass: o ?? uM,
    isResolvedFromDuration: !1,
    // stiffness/damping/mass overrides duration/bounce
    isTimeDefined: (a ?? s ?? o) === void 0 && (i.duration !== void 0 || i.bounce !== void 0)
  };
  if (c.isTimeDefined) {
    if (i.visualDuration) {
      const d = Wb(i.bounce || 0), f = 2 * Math.PI / (i.visualDuration * 1.2) * $b(d, 2 * Math.PI / 1.2);
      c.stiffness = f * f, c.damping = 2 * d * Math.sqrt(c.stiffness);
    } else
      Object.assign(c, bM(c)), c.isResolvedFromDuration = !0;
    (!Ud(c.stiffness) || !Ud(c.damping, !0)) && (c.stiffness = Y0, c.damping = q0);
  }
  return c;
}
function Q0(i = fM, a = Ib) {
  const s = typeof i != "object" ? {
    visualDuration: i,
    keyframes: [0, 1],
    bounce: a
  } : i, o = s.keyframes[0], c = s.keyframes[s.keyframes.length - 1], d = { done: !1, value: o }, { stiffness: f, damping: h, mass: p, duration: g, isResolvedFromDuration: v, isTimeDefined: y } = e1({ ...s }), S = (z) => v ? 0 : -/* @__PURE__ */ $e(z), E = h / (2 * Math.sqrt(f * p)), A = /* @__PURE__ */ $e(Math.sqrt(f / p)), w = E * A, M = {
    target: c,
    delta: c - o,
    velocity: S(s.velocity) || 0,
    restSpeed: 0,
    restDelta: 0
  }, C = () => {
    const z = Math.abs(M.delta) < 5;
    M.restSpeed = s.restSpeed || (z ? dM : hM), M.restDelta = s.restDelta || (z ? mM : pM);
  };
  C();
  let N, H, X;
  if (E < 1) {
    const z = Ld(A, E), D = { A: 0, sinC: 0, cosC: 0, t: -1, env: 0, sin: 0, cos: 0 };
    X = () => {
      D.A = (M.velocity + w * M.delta) / z, D.sinC = w * D.A + M.delta * z, D.cosC = w * M.delta - D.A * z;
    };
    const at = (lt) => {
      lt !== D.t && (D.t = lt, D.env = Math.exp(-w * lt), D.sin = Math.sin(z * lt), D.cos = Math.cos(z * lt));
    };
    N = (lt) => (at(lt), M.target - D.env * (D.A * D.sin + M.delta * D.cos)), H = (lt) => (at(lt), D.env * (D.sinC * D.sin + D.cosC * D.cos));
  } else if (E === 1) {
    N = (D) => M.target - Math.exp(-A * D) * (M.delta + (M.velocity + A * M.delta) * D);
    const z = { C: 0 };
    X = () => {
      z.C = M.velocity + A * M.delta;
    }, H = (D) => Math.exp(-A * D) * (A * z.C * D - M.velocity);
  } else {
    const z = A * Math.sqrt(E * E - 1), D = w - z, at = w + z, lt = z < 1 || y ? 1 / 0 : 300 / z, st = (vt, xt) => Math.exp(xt > lt ? (w - vt) * lt - w * xt : -vt * xt), dt = { S: 0, F: 0 };
    X = () => {
      const vt = (M.velocity + w * M.delta) / z;
      dt.S = (M.delta + vt) / 2, dt.F = (M.delta - vt) / 2;
    }, N = (vt) => M.target - dt.S * st(D, vt) - dt.F * st(at, vt), H = (vt) => D * dt.S * st(D, vt) + at * dt.F * st(at, vt);
  }
  X();
  const I = v && g || null, et = {
    calculatedDuration: I,
    /**
     * Aim the spring at a new target from its current position and
     * velocity, reusing the resolved physics and closures.
     */
    retarget: (z, D) => {
      M.target = z[z.length - 1], M.delta = M.target - z[0], M.velocity = S(D), s.restSpeed && s.restDelta || C(), et.calculatedDuration = I, d.done = !1, X();
    },
    velocity: (z) => /* @__PURE__ */ Oe(H(z)),
    next: (z) => {
      const D = N(z);
      if (v)
        d.done = z >= g;
      else {
        const at = /* @__PURE__ */ Oe(H(z));
        d.done = Math.abs(at) <= M.restSpeed && Math.abs(M.target - D) <= M.restDelta;
      }
      return d.value = d.done ? M.target : D, d;
    },
    toString: () => {
      const z = Math.min(hu(et), Dh), D = Fb((at) => et.next(z * at).value, z, 30);
      return z + "ms " + D;
    }
  };
  return et;
}
const Ir = /* @__PURE__ */ Object.assign(Q0, {
  applyToOptions: (i) => {
    const a = rM(i, 100, Q0);
    return i.ease = a.ease, i.duration = /* @__PURE__ */ Oe(a.duration), i.type = "keyframes", i;
  }
});
function Wr({ keyframes: i, velocity: a = 0, power: s = 0.8, timeConstant: o = 325, bounceDamping: c = 10, bounceStiffness: d = 500, modifyTarget: f, min: h, max: p, restDelta: g = 0.5, restSpeed: v }) {
  const y = i[0], S = {
    done: !1,
    value: y
  }, E = (z) => z < h || z > p, A = (z) => h === void 0 ? p : p === void 0 || Math.abs(h - z) < Math.abs(p - z) ? h : p;
  let w = s * a;
  const M = y + w, C = f ? f(M) : M;
  C !== M && (w = C - y);
  const N = (z) => -w * Math.exp(-z / o), H = (z) => {
    const D = N(z);
    S.done = Math.abs(D) <= g, S.value = S.done ? C : z ? C + D : y;
  };
  let X, I;
  const et = (z) => {
    E(S.value) && (X = z, I = Ir({
      keyframes: [S.value, A(S.value)],
      /**
       * The friction curve is target + calcDelta(t), so its exact
       * derivative is -calcDelta(t) / timeConstant in units/ms,
       * converted here to the units/second expected by spring.
       */
      velocity: -N(z) / o * 1e3,
      damping: c,
      stiffness: d,
      restDelta: g,
      restSpeed: v
    }));
  };
  return et(0), {
    calculatedDuration: null,
    next: (z) => {
      let D = !1;
      return !I && X === void 0 && (D = !0, H(z), et(z)), X !== void 0 && z >= X ? I.next(z - X) : (!D && H(z), S);
    }
  };
}
function SM(i, a, s) {
  const o = [], c = Mn.mix || wh, d = i.length - 1;
  for (let f = 0; f < d; f++) {
    let h = (s == null ? void 0 : s(i[f], i[f + 1])) || c(i[f], i[f + 1]);
    if (a) {
      const p = Array.isArray(a) ? a[f] || xn : a;
      h = Ml(p, h);
    }
    o.push(h);
  }
  return o;
}
function TM(i, a, { clamp: s = !0, ease: o, mixer: c } = {}) {
  const d = i.length;
  if (d === 1)
    return () => a[0];
  if (d === 2 && a[0] === a[1])
    return () => a[1];
  const f = i[0] === i[1];
  i[0] > i[d - 1] && (i = [...i].reverse(), a = [...a].reverse());
  const h = SM(a, o, c), p = h.length, g = (v) => {
    if (f && v < i[0])
      return a[0];
    let y = 0;
    if (p > 1)
      for (; y < i.length - 2 && !(v < i[y + 1]); y++)
        ;
    const S = /* @__PURE__ */ Ea(i[y], i[y + 1], v);
    return h[y](S);
  };
  return s ? (v) => g(Gn(i[0], i[d - 1], v)) : g;
}
function EM(i, a) {
  const s = i[i.length - 1];
  for (let o = 1; o <= a; o++) {
    const c = /* @__PURE__ */ Ea(0, a, o);
    i.push(Jt(s, 1, c));
  }
}
function Ks(i) {
  const a = [0];
  return EM(a, i.length - 1), a;
}
function AM(i, a) {
  return i.map((s) => s * a);
}
function xM(i, a) {
  return i.map(() => a || Sh).splice(0, i.length - 1);
}
function ji({ duration: i = 300, keyframes: a, times: s, ease: o = "easeInOut", mixer: c }) {
  const d = typeof a[0] == "number" ? void 0 : c, f = /* @__PURE__ */ Gb(o) ? o.map(Nd) : Nd(o) || Sh, h = {
    done: !1,
    value: a[0]
  };
  let p = -1;
  if (!d) {
    for (let y = 1; y < a.length; y++)
      if (a[y] !== a[y - 1]) {
        if (p >= 0) {
          p = -2;
          break;
        }
        p = y - 1;
      }
  }
  if (p >= 0) {
    const y = s && s.length === a.length ? s : Ks(a), S = y[p] * i, E = y[p + 1] * i, A = a[p], w = a[p + 1], M = Array.isArray(f) ? f[p] : f, C = (Mn.mix || wh)(A, w), N = a.length - 2;
    return {
      calculatedDuration: i,
      next: (H) => (h.value = p && H < S ? C(0) : p < N && (H >= E || !i) ? typeof w == "number" ? w : C(1) : C(M(H >= E || !i ? 1 : H <= S ? 0 : (H - S) / (E - S))), h.done = H >= i, h)
    };
  }
  const g = AM(
    // Only use the provided offsets if they're the correct length
    // TODO Maybe we should warn here if there's a length mismatch
    s && s.length === a.length ? s : Ks(a),
    i
  ), v = TM(g, a, {
    ease: Array.isArray(f) ? f : xM(a, f),
    mixer: d
  });
  return {
    calculatedDuration: i,
    next: (y) => (h.value = v(y), h.done = y >= i, h)
  };
}
const MM = 5;
function wM(i, a, s) {
  const o = Math.max(a - MM, 0);
  return /* @__PURE__ */ Nb(s - i(o), a - o);
}
function CM(i, a, s = 0) {
  return a <= 0 ? s : i.velocity ? i.velocity(a) : wM((o) => i.next(o).value, a, i.next(a).value);
}
function ks(i, { repeat: a, repeatType: s = "loop" }, o, c = 1) {
  let d, f, h = 0;
  for (let v = 0; v < i.length; v++) {
    const y = i[v];
    y !== null && (h++ || (d = y), f = y);
  }
  const g = c < 0 || a && s !== "loop" && a % 2 === 1 ? 0 : h - 1;
  return !g || o === void 0 ? g ? f : d : o;
}
const DM = {
  decay: Wr,
  inertia: Wr,
  tween: ji,
  keyframes: ji,
  spring: Ir
};
function n1(i) {
  typeof i.type == "string" && (i.type = DM[i.type]);
}
const OM = 40, i1 = (i, a) => a - i > OM && !Mn.useManualTiming ? a : i;
function a1(i, a) {
  return {
    kind: i,
    animation: a,
    timestamp: Gt.now(),
    frameTimestamp: le.timestamp,
    frameIsProcessing: le.isProcessing
  };
}
function l1(i, a, s) {
  const o = globalThis.__MOTION_INSPECT__;
  if (o)
    try {
      o({
        ...a1("animation-start", i),
        options: s ? { ...a, ...s } : a
      });
    } catch {
    }
}
function zM(i, a) {
  const s = globalThis.__MOTION_INSPECT__;
  if (s)
    try {
      s({
        ...a1("layout-animation-start", i),
        node: a
      });
    } catch {
    }
}
class Oh {
  constructor() {
    this.isResolved = !1;
  }
  get finished() {
    return this._finished || (this._finished = this.isResolved ? Promise.resolve() : new Promise((a) => {
      this._resolve = a;
    })), this._finished;
  }
  updateFinished() {
    this._finished = this._resolve = void 0, this.isResolved = !1;
  }
  notifyFinished() {
    var a;
    this.isResolved = !0, (a = this._resolve) == null || a.call(this);
  }
  /**
   * Allows the animation to be awaited.
   *
   * @deprecated Use `finished` instead.
   */
  then(a, s) {
    return this.finished.then(a, s);
  }
}
const RM = (i) => i / 100, Ps = (i) => Math.round(i * 1e4) / 1e4;
class wl extends Oh {
  constructor(a) {
    super(), this.state = "idle", this.startTime = null, this.isStopped = !1, this.currentTime = 0, this.holdTime = null, this.playbackSpeed = 1, this.delayState = {
      done: !1,
      value: void 0
    }, this.stop = () => {
      var c, d;
      const { motionValue: s } = this.options, o = Gt.now();
      s && s.updatedAt !== o && this.tick(s.updatedAt = o), this.isStopped = !0, this.state !== "idle" && (this.teardown(), (d = (c = this.options).onStop) == null || d.call(c));
    }, this.options = a, this.initAnimation(), this.play(), a.autoplay === !1 && this.pause(), l1(this, this.options);
  }
  initAnimation() {
    var y;
    const { options: a } = this;
    n1(a);
    const { type: s = ji, repeat: o = 0, repeatDelay: c = 0, repeatType: d, velocity: f = 0 } = a;
    let { keyframes: h } = a;
    const p = s || ji;
    this.mixKeyframes = void 0, p !== ji && typeof h[0] != "number" && (this.mixKeyframes = Ml(RM, ((y = a.mixer) == null ? void 0 : y.call(a, h[0], h[1])) || wh(h[0], h[1])), h = [0, 100]);
    const g = p(h === a.keyframes ? a : { ...a, keyframes: h });
    d === "mirror" && (this.mirroredGenerator = p({
      ...a,
      keyframes: [...h].reverse(),
      velocity: -f
    })), g.calculatedDuration === null && (g.calculatedDuration = hu(g));
    const { calculatedDuration: v } = g;
    this.calculatedDuration = v, this.resolvedDuration = v + c, this.totalDuration = this.resolvedDuration * (o + 1) - c, this.generator = g;
  }
  updateTime(a) {
    this.currentTime = this.holdTime ?? Math.round(a - this.startTime) * this.playbackSpeed;
  }
  tick(a, s = !1) {
    const { generator: o, totalDuration: c, calculatedDuration: d } = this;
    if (this.startTime === null)
      return o.next(0);
    const { delay: f = 0, keyframes: h, type: p, onUpdate: g, finalKeyframe: v } = this.options;
    this.startTime === this.pendingStartTime && (this.startTime = i1(this.startTime, a)), this.pendingStartTime = void 0, this.speed > 0 ? this.startTime = Math.min(this.startTime, a) : this.speed < 0 && (this.startTime = Math.min(a - c / this.speed, this.startTime)), s ? this.currentTime = a : this.updateTime(a);
    const y = this.currentTime - f * (this.playbackSpeed >= 0 ? 1 : -1), S = this.playbackSpeed >= 0 ? y < 0 : y > c;
    this.currentTime = Math.max(y, 0), this.state === "finished" && this.holdTime === null && (this.currentTime = c);
    const E = this.generate(this.currentTime, S);
    let { done: A } = E;
    S || (A = this.playbackSpeed >= 0 ? d < 1 / 0 ? this.currentTime >= c : A : this.currentTime <= 0);
    const w = this.holdTime === null && (this.state === "finished" || this.state === "running" && A);
    return w && p !== Wr && (E.value = ks(h, this.options, v, this.speed)), g && g(E.value), w && this.finish(), E;
  }
  /**
   * This animation's time, including delay, at a timestamp.
   */
  at(a) {
    return this.holdTime ?? Ps((a - this.startTime) * this.playbackSpeed);
  }
  /**
   * The value at a timestamp, without changing this animation's state.
   * If resolved, it ends at the last resolved keyframe, which is in the
   * same unit as the others, rather than at finalKeyframe.
   */
  sampleAt(a, s) {
    const { options: o, totalDuration: c } = this, d = this.at(a) - (o.delay || 0);
    return d >= c && o.type !== Wr ? ks(o.keyframes, o, s ? void 0 : o.finalKeyframe) : this.generate(Math.max(d, 0), d < 0).value;
  }
  /**
   * The generator's state `currentTime` ms after the delay, without
   * changing the animation's own state.
   */
  generate(a, s) {
    const { generator: o, totalDuration: c, mixKeyframes: d, mirroredGenerator: f, resolvedDuration: h } = this, { keyframes: p, repeat: g, repeatType: v, repeatDelay: y } = this.options;
    let S = a, E = o;
    if (g) {
      const w = Math.min(a, c) / h;
      let M = Math.floor(w), C = w % 1;
      !C && w >= 1 && (C = 1), C === 1 && M--, M = Math.min(M, g + 1), !!(M % 2) && (v === "reverse" ? (C = 1 - C, y && (C -= y / h)) : v === "mirror" && (E = f)), S = Gn(0, 1, C) * h;
    }
    let A;
    return s ? (this.delayState.value = p[0], A = this.delayState) : A = E.next(S), d && !s && (A.value = d(A.value)), A;
  }
  get duration() {
    return /* @__PURE__ */ $e(this.calculatedDuration);
  }
  get iterationDuration() {
    return this.duration + /* @__PURE__ */ $e(this.options.delay ?? 0);
  }
  get time() {
    return /* @__PURE__ */ $e(this.currentTime);
  }
  set time(a) {
    this.state === "finished" && this.updateFinished(), a = /* @__PURE__ */ Oe(a), this.currentTime = a, this.startTime === null || this.holdTime !== null || this.playbackSpeed === 0 ? this.holdTime = a : this.driver && (this.startTime = this.driver.now() - a / this.playbackSpeed), this.driver ? this.driver.start(!1) : (this.startTime = 0, this.state = "paused", this.holdTime = a, this.tick(a));
  }
  /**
   * Returns the generator's velocity at the current time in units/second.
   * Uses the analytical derivative when available (springs), avoiding
   * the MotionValue's frame-dependent velocity estimation.
   */
  getGeneratorVelocity() {
    return CM(this.generator, this.currentTime, this.options.velocity);
  }
  get speed() {
    return this.playbackSpeed;
  }
  set speed(a) {
    const s = this.playbackSpeed !== a;
    s && this.driver && this.updateTime(Gt.now()), this.playbackSpeed = a, s && this.driver && (this.time = /* @__PURE__ */ $e(this.currentTime));
  }
  play() {
    var c, d;
    if (this.isStopped)
      return;
    const { driver: a = Ch, startTime: s } = this.options;
    this.driver || (this.driver = a((f) => this.tick(f))), (d = (c = this.options).onPlay) == null || d.call(c);
    const o = this.driver.now();
    this.state === "finished" ? (this.updateFinished(), this.startTime = o) : this.holdTime !== null ? this.startTime = o - this.holdTime / (this.playbackSpeed || 1) : this.startTime || (this.startTime = s ?? (this.pendingStartTime = o)), this.state === "finished" && this.speed < 0 && (this.startTime += this.calculatedDuration), this.holdTime = null, this.state = "running", this.driver.start();
  }
  pause() {
    this.state = "paused", this.updateTime(Gt.now()), this.holdTime = this.currentTime;
  }
  complete() {
    this.state !== "running" && this.play(), this.state = "finished", this.holdTime = null;
  }
  finish() {
    var a, s;
    this.notifyFinished(), this.teardown(), this.state = "finished", (s = (a = this.options).onComplete) == null || s.call(a);
  }
  cancel() {
    var a, s;
    this.holdTime = null, this.startTime = 0, this.tick(0), this.teardown(), (s = (a = this.options).onCancel) == null || s.call(a);
  }
  teardown() {
    var a;
    this.state = "idle", (a = this.driver) == null || a.stop(), this.driver = void 0, this.startTime = this.holdTime = null;
  }
  sample(a) {
    return this.startTime = 0, this.tick(a, !0);
  }
  attachTimeline(a) {
    var s;
    return this.options.allowFlatten && (this.options.type = "keyframes", this.options.ease = "linear", this.initAnimation()), (s = this.driver) == null || s.stop(), a.observe(this);
  }
}
const NM = /* @__PURE__ */ new Set(["brightness", "contrast", "saturate", "opacity"]);
function _M(i) {
  const [a, s] = i.slice(0, -1).split("(");
  if (a === "drop-shadow")
    return i;
  const [o] = s.match(Eh) || [];
  if (!o)
    return i;
  const c = s.replace(o, "");
  let d = NM.has(a) ? 1 : 0;
  return o !== s && (d *= 100), a + "(" + d + c + ")";
}
const VM = /\b([a-z-]*)\(.*?\)/gu, Bd = {
  ...dn,
  getAnimatableNone: (i) => {
    const a = i.match(VM);
    return a ? a.map(_M).join(" ") : i;
  }
}, Hd = {
  ...dn,
  getAnimatableNone: (i) => {
    const a = dn.parse(i);
    return dn.createTransformer(i)(a.map((o) => typeof o == "number" ? 0 : typeof o == "object" ? { ...o, alpha: 1 } : o));
  }
}, Z0 = {
  ...Ol,
  transform: Math.round
}, s1 = {
  rotate: ai,
  /**
   * Internal channel for `transition.path` orientToPath. Composed onto
   * `rotate` at the transform-build sites so the user's `rotate` is
   * never read or overwritten. Not part of `transformPropOrder`.
   */
  pathRotation: ai,
  rotateX: ai,
  rotateY: ai,
  rotateZ: ai,
  scale: Rr,
  scaleX: Rr,
  scaleY: Rr,
  scaleZ: Rr,
  skew: ai,
  skewX: ai,
  skewY: ai,
  distance: gt,
  translateX: gt,
  translateY: gt,
  translateZ: gt,
  x: gt,
  y: gt,
  z: gt,
  perspective: gt,
  transformPerspective: gt,
  opacity: Qs,
  originX: U0,
  originY: U0,
  originZ: gt
}, zh = {
  // Border props
  borderWidth: gt,
  borderTopWidth: gt,
  borderRightWidth: gt,
  borderBottomWidth: gt,
  borderLeftWidth: gt,
  borderRadius: gt,
  borderTopLeftRadius: gt,
  borderTopRightRadius: gt,
  borderBottomRightRadius: gt,
  borderBottomLeftRadius: gt,
  // Positioning props
  width: gt,
  maxWidth: gt,
  height: gt,
  maxHeight: gt,
  top: gt,
  right: gt,
  bottom: gt,
  left: gt,
  inset: gt,
  insetBlock: gt,
  insetBlockStart: gt,
  insetBlockEnd: gt,
  insetInline: gt,
  insetInlineStart: gt,
  insetInlineEnd: gt,
  // Spacing props
  padding: gt,
  paddingTop: gt,
  paddingRight: gt,
  paddingBottom: gt,
  paddingLeft: gt,
  paddingBlock: gt,
  paddingBlockStart: gt,
  paddingBlockEnd: gt,
  paddingInline: gt,
  paddingInlineStart: gt,
  paddingInlineEnd: gt,
  margin: gt,
  marginTop: gt,
  marginRight: gt,
  marginBottom: gt,
  marginLeft: gt,
  marginBlock: gt,
  marginBlockStart: gt,
  marginBlockEnd: gt,
  marginInline: gt,
  marginInlineStart: gt,
  marginInlineEnd: gt,
  // Typography
  fontSize: gt,
  // Misc
  backgroundPositionX: gt,
  backgroundPositionY: gt,
  ...s1,
  zIndex: Z0,
  // SVG
  fillOpacity: Qs,
  strokeOpacity: Qs,
  numOctaves: Z0
}, LM = {
  ...zh,
  // Color props
  color: he,
  backgroundColor: he,
  outlineColor: he,
  fill: he,
  stroke: he,
  // Border props
  borderColor: he,
  borderTopColor: he,
  borderRightColor: he,
  borderBottomColor: he,
  borderLeftColor: he,
  filter: Bd,
  WebkitFilter: Bd,
  mask: Hd,
  WebkitMask: Hd
}, o1 = (i) => LM[i], UM = /* @__PURE__ */ new Set([Bd, Hd]);
let K0, k0, md;
function Rh(i, a) {
  if (i === K0 && a === k0)
    return md;
  let s = o1(i);
  return UM.has(s) || (s = dn), md = s.getAnimatableNone ? s.getAnimatableNone(a) : void 0, K0 = i, k0 = a, md;
}
function BM(i) {
  for (let a = 1; a < i.length; a++)
    i[a] ?? (i[a] = i[a - 1]);
}
const va = (i) => i * 180 / Math.PI, jd = (i) => {
  const a = va(Math.atan2(i[1], i[0]));
  return Gd(a);
}, HM = {
  x: 4,
  y: 5,
  translateX: 4,
  translateY: 5,
  scaleX: 0,
  scaleY: 3,
  scaleZ: () => 1,
  scale: (i) => (Math.abs(i[0]) + Math.abs(i[3])) / 2,
  rotate: jd,
  rotateZ: jd,
  skewX: (i) => va(Math.atan(i[1])),
  skewY: (i) => va(Math.atan(i[2])),
  skew: (i) => (Math.abs(i[1]) + Math.abs(i[2])) / 2
}, Gd = (i) => (i = i % 360, i < 0 && (i += 360), i), P0 = jd, J0 = (i) => Math.hypot(i[0], i[1]), F0 = (i) => Math.hypot(i[4], i[5]), jM = {
  x: 12,
  y: 13,
  z: 14,
  translateX: 12,
  translateY: 13,
  translateZ: 14,
  scaleX: J0,
  scaleY: F0,
  scaleZ: (i) => Math.hypot(i[8], i[9], i[10]),
  scale: (i) => (J0(i) + F0(i)) / 2,
  rotateX: (i) => Gd(va(Math.atan2(i[6], i[5]))),
  rotateY: (i) => Gd(va(Math.atan2(-i[2], i[0]))),
  rotateZ: P0,
  rotate: P0,
  skewX: (i) => va(Math.atan(i[4])),
  skewY: (i) => va(Math.atan(i[1])),
  skew: (i) => (Math.abs(i[1]) + Math.abs(i[4])) / 2
};
function Js(i) {
  return i.includes("scale") ? 1 : 0;
}
function Nh(i, a) {
  if (!i || i === "none")
    return Js(a);
  const s = i.match(/^matrix(3d)?\(([-\d.e\s,]+)\)$/u);
  if (!s)
    return Js(a);
  const o = (s[1] ? jM : HM)[a], c = s[2].split(",").map((d) => parseFloat(d));
  return typeof o == "function" ? o(c) : c[o];
}
const GM = (i, a) => {
  const { transform: s = "none" } = getComputedStyle(i);
  return Nh(s, a);
}, si = [
  "transformPerspective",
  "x",
  "y",
  "z",
  "translateX",
  "translateY",
  "translateZ",
  "scale",
  "scaleX",
  "scaleY",
  "scaleZ",
  "rotate",
  "rotateX",
  "rotateY",
  "rotateZ",
  "skew",
  "skewX",
  "skewY"
], Gi = /* @__PURE__ */ new Set([...si, "pathRotation"]), I0 = (i) => i === Ol || i === gt, YM = /* @__PURE__ */ new Set(["x", "y", "z"]), qM = /* @__PURE__ */ si.filter((i) => !YM.has(i));
function XM(i) {
  const a = [];
  return qM.forEach((s) => {
    const o = i.getValue(s);
    if (o !== void 0) {
      const c = o.get(), d = s.startsWith("scale") ? 1 : 0;
      if (c === d)
        return;
      a.push([s, c]), o.set(d);
    }
  }), a;
}
const QM = /* @__PURE__ */ new Set(["bottom", "right"]);
function W0(i, a, s, o, c, d) {
  const f = parseFloat(i);
  if (!isNaN(f))
    return f;
  const { min: h, max: p } = a()[s], g = p - h;
  return d === "border-box" ? g : g - parseFloat(o) - parseFloat(c);
}
const $0 = ({ transform: i }) => Nh(i, "x"), tv = ({ transform: i }) => Nh(i, "y"), pd = {
  // Dimensions
  width: ({ width: i, paddingLeft: a = "0", paddingRight: s = "0", boxSizing: o }, c) => W0(i, c, "x", a, s, o),
  height: ({ height: i, paddingTop: a = "0", paddingBottom: s = "0", boxSizing: o }, c) => W0(i, c, "y", a, s, o),
  top: ({ top: i }) => parseFloat(i),
  left: ({ left: i }) => parseFloat(i),
  bottom: ({ top: i }, a) => {
    const { y: s } = a();
    return parseFloat(i) + (s.max - s.min);
  },
  right: ({ left: i }, a) => {
    const { x: s } = a();
    return parseFloat(i) + (s.max - s.min);
  },
  // Transform, including translate longform names
  x: $0,
  y: tv,
  translateX: $0,
  translateY: tv
}, ba = /* @__PURE__ */ new Set();
let Yd = !1, qd = !1, Xd = !1;
function r1() {
  if (qd) {
    const i = [], a = /* @__PURE__ */ new Set(), s = /* @__PURE__ */ new Set();
    ba.forEach((c) => {
      c.needsMeasurement && (i.push(c), a.add(c.element), QM.has(c.name) && s.add(c.element));
    });
    const o = /* @__PURE__ */ new Map();
    s.forEach((c) => {
      const d = XM(c);
      d.length && (o.set(c, d), c.render());
    }), i.forEach((c) => c.measureInitialState()), a.forEach((c) => {
      c.render();
      const d = o.get(c);
      d && d.forEach(([f, h]) => {
        var p;
        (p = c.getValue(f)) == null || p.set(h);
      });
    }), i.forEach((c) => c.measureEndState()), i.forEach((c) => {
      c.suspendedScrollY !== void 0 && window.scrollTo(0, c.suspendedScrollY);
    });
  }
  qd = !1, Yd = !1, ba.forEach((i) => i.complete(Xd)), ba.clear();
}
function u1() {
  ba.forEach((i) => {
    i.readKeyframes(), i.needsMeasurement && (qd = !0);
  });
}
function ZM() {
  Xd = !0, u1(), r1(), Xd = !1;
}
function KM(i, a, s) {
  if (typeof i == "string") {
    if (gh(i) || yh(i))
      return parseFloat(i);
    if (!dn.test(i) && dn.test(s))
      return Rh(a, s);
  }
  return i ?? void 0;
}
class _h {
  constructor(a, s, o, c, d, f = !1) {
    this.state = "pending", this.isAsync = !1, this.needsMeasurement = !1, this.unresolvedKeyframes = [...a], this.onComplete = s, this.name = o, this.motionValue = c, this.element = d, this.isAsync = f;
  }
  scheduleResolve() {
    this.state = "scheduled", this.isAsync ? (ba.add(this), Yd || (Yd = !0, qt.read(u1), qt.resolveKeyframes(r1))) : (this.readKeyframes(), this.complete());
  }
  readKeyframes() {
    const { unresolvedKeyframes: a, name: s, element: o, motionValue: c } = this;
    if (a[0] === null) {
      const d = c == null ? void 0 : c.get(), f = a[a.length - 1];
      if (d !== void 0)
        a[0] = d;
      else if (o && s) {
        const h = KM(o.readValue(s, f), s, f);
        h !== void 0 && (a[0] = h);
      }
      a[0] === void 0 && (a[0] = f), c && d === void 0 && c.set(a[0]);
    }
    BM(a);
  }
  setFinalKeyframe() {
  }
  measureInitialState() {
  }
  renderEndStyles() {
  }
  measureEndState() {
  }
  complete(a = !1) {
    this.state = "complete", this.onComplete(this.unresolvedKeyframes, this.finalKeyframe, a), ba.delete(this);
  }
  cancel() {
    this.state === "scheduled" && (ba.delete(this), this.state = "pending");
  }
  resume() {
    this.state === "pending" && this.scheduleResolve();
  }
}
const kM = (i) => i.startsWith("--");
function c1(i, a, s) {
  kM(a) ? i.style.setProperty(a, s) : i.style[a] = s;
}
const PM = {};
function f1(i, a) {
  const s = /* @__PURE__ */ wx(i);
  return () => PM[a] ?? s();
}
const JM = /* @__PURE__ */ f1(() => window.ScrollTimeline !== void 0, "scrollTimeline"), Vh = /* @__PURE__ */ f1(() => {
  try {
    document.createElement("div").animate({ opacity: 0 }, { easing: "linear(0, 1)" });
  } catch {
    return !1;
  }
  return !0;
}, "linearEasing"), Sl = ([i, a, s, o]) => `cubic-bezier(${i}, ${a}, ${s}, ${o})`, Qd = {
  linear: "linear",
  ease: "ease",
  easeIn: "ease-in",
  easeOut: "ease-out",
  easeInOut: "ease-in-out",
  circIn: /* @__PURE__ */ Sl([0, 0.65, 0.55, 1]),
  circOut: /* @__PURE__ */ Sl([0.55, 0, 1, 0.45]),
  backIn: /* @__PURE__ */ Sl([0.31, 0.01, 0.66, -0.59]),
  backOut: /* @__PURE__ */ Sl([0.33, 1.53, 0.69, 0.99])
};
function d1(i, a) {
  if (i)
    return typeof i == "function" ? Vh() ? Fb(i, a) : "ease-out" : /* @__PURE__ */ Th(i) ? Sl(i) : Array.isArray(i) ? i.map((s) => d1(s, a) || Qd.easeOut) : Qd[i];
}
function FM(i, a, s, { delay: o = 0, duration: c = 300, repeat: d = 0, repeatType: f = "loop", ease: h = "easeOut", times: p } = {}, g = void 0) {
  const v = {
    [a]: s
  };
  p && (v.offset = p);
  const y = d1(h, c);
  Array.isArray(y) && (v.easing = y);
  const S = {
    delay: o,
    duration: c,
    easing: Array.isArray(y) ? "linear" : y,
    fill: "both",
    iterations: d + 1,
    direction: f === "reverse" ? "alternate" : "normal"
  };
  return g && (S.pseudoElement = g), i.animate(v, S);
}
function h1(i) {
  return typeof i == "function" && "applyToOptions" in i;
}
function IM({ type: i, ...a }) {
  return h1(i) && Vh() ? i.applyToOptions(a) : (a.duration ?? (a.duration = 300), a.ease ?? (a.ease = "easeOut"), a);
}
class m1 extends Oh {
  constructor(a) {
    if (super(), this.finishedTime = null, this.isStopped = !1, this.manualStartTime = null, !a)
      return;
    const { element: s, name: o, keyframes: c, pseudoElement: d, allowFlatten: f = !1, finalKeyframe: h, onComplete: p } = a;
    this.isPseudoElement = !!d, this.allowFlatten = f, this.options = a;
    const g = IM(a);
    this.animation = FM(s, o, c, g, d), g.autoplay === !1 && this.animation.pause(), this.animation.onfinish = this.onFinish = () => {
      var v;
      if (this.animation.onfinish = null, this.finishedTime = this.time, !d) {
        const y = ks(c, this.options, h, this.speed);
        (v = this.updateMotionValue) == null || v.call(this, y), c1(s, o, y), this.animation.cancel();
      }
      p == null || p(), this.notifyFinished();
    }, l1(this, a, g);
  }
  play() {
    this.isStopped || (this.manualStartTime = null, this.animation.onfinish = this.onFinish, this.animation.play(), this.state === "finished" && this.updateFinished());
  }
  pause() {
    this.animation.pause();
  }
  complete() {
    var a, s;
    this.isStopped || (this.animation.onfinish = this.onFinish), (s = (a = this.animation).finish) == null || s.call(a);
  }
  cancel() {
    this.animation.onfinish = null;
    try {
      this.animation.cancel();
    } catch {
    }
  }
  stop() {
    this.isStopped || (this.isStopped = !0, !(this.state === "idle" || this.finishedTime !== null) && (this.updateMotionValue ? this.updateMotionValue() : this.commitStyles(), this.isPseudoElement || this.cancel()));
  }
  /**
   * WAAPI doesn't natively have any interruption capabilities.
   *
   * In this method, we commit styles back to the DOM before cancelling
   * the animation.
   *
   * This is designed to be overridden by NativeAnimationExtended, which
   * will create a renderless JS animation and sample it twice to calculate
   * its current value, "previous" value, and therefore allow
   * Motion to also correctly calculate velocity for any subsequent animation
   * while deferring the commit until the next animation frame.
   */
  commitStyles() {
    var s, o, c;
    const a = (s = this.options) == null ? void 0 : s.element;
    !this.isPseudoElement && (a != null && a.isConnected) && ((c = (o = this.animation).commitStyles) == null || c.call(o));
  }
  get duration() {
    var s, o;
    const a = ((o = (s = this.animation.effect) == null ? void 0 : s.getComputedTiming) == null ? void 0 : o.call(s).duration) || 0;
    return /* @__PURE__ */ $e(Number(a));
  }
  get iterationDuration() {
    const { delay: a = 0 } = this.options || {};
    return this.duration + /* @__PURE__ */ $e(a);
  }
  get time() {
    return /* @__PURE__ */ $e(Number(this.animation.currentTime) || 0);
  }
  set time(a) {
    const s = this.finishedTime !== null;
    this.manualStartTime = null, this.finishedTime = null, this.animation.currentTime = /* @__PURE__ */ Oe(a), s && (this.animation.pause(), this.updateFinished());
  }
  /**
   * The playback speed of the animation.
   * 1 = normal speed, 2 = double speed, 0.5 = half speed.
   */
  get speed() {
    return this.animation.playbackRate;
  }
  set speed(a) {
    a < 0 && (this.finishedTime = null), this.animation.playbackRate = a;
  }
  get state() {
    return this.finishedTime !== null ? "finished" : this.animation.playState;
  }
  get startTime() {
    return this.manualStartTime ?? Number(this.animation.startTime);
  }
  set startTime(a) {
    this.manualStartTime = this.animation.startTime = a;
  }
  /**
   * Attaches a timeline to the animation, for instance the `ScrollTimeline`.
   */
  attachTimeline({ timeline: a, onAttach: s, observe: o }) {
    var c;
    return this.allowFlatten && ((c = this.animation.effect) == null || c.updateTiming({ easing: "linear" })), this.animation.onfinish = this.onFinish = null, a && JM() ? (this.animation.timeline = a, s == null || s(this.animation), xn) : o(this);
  }
}
const p1 = {
  anticipate: Bb,
  backInOut: Ub,
  circInOut: jb
};
function WM(i) {
  return i in p1;
}
function $M(i) {
  typeof i.ease == "string" && WM(i.ease) && (i.ease = p1[i.ease]);
}
const $r = 10;
class t2 extends m1 {
  constructor(a) {
    $M(a), n1(a), super(a), a.startTime !== void 0 && a.autoplay !== !1 && (this.startTime = a.startTime), this.options = a;
  }
  /**
   * The animation's time now, in ms. Wall-clock rather than WAAPI's
   * currentTime while running, as under CPU load currentTime may not
   * reflect the actual elapsed time, causing incorrect sampling and
   * visual jumps.
   */
  elapsed() {
    return this.state === "running" ? (Gt.now() - this.startTime) * this.speed : this.time * 1e3;
  }
  /**
   * The value at a time, from a renderless JS animation.
   */
  sample(a) {
    if (!this.sampler) {
      const { motionValue: s, onUpdate: o, onComplete: c, onPlay: d, onStop: f, element: h, ...p } = this.options;
      this.sampler = new wl({ ...p, autoplay: !1 }), this.sampler.stop();
    }
    return this.sampler.sample(Math.max(0, a)).value;
  }
  /**
   * The value now, as WAAPI doesn't set the motion value while it runs.
   */
  liveValue() {
    const { state: a } = this;
    if (a === "running" || a === "paused")
      return this.sample(this.elapsed());
  }
  /**
   * WAAPI doesn't natively have any interruption capabilities.
   *
   * Rather than read committed styles back out of the DOM, we can
   * sample a renderless JS animation twice to calculate its current
   * value, "previous" value, and therefore allow Motion to calculate
   * velocity for any subsequent animation.
   */
  updateMotionValue(a) {
    const { motionValue: s, element: o, name: c } = this.options;
    if (!s)
      return;
    if (a !== void 0) {
      s.set(a);
      return;
    }
    const { speed: d } = this, f = this.elapsed(), h = this.state === "running" && d ? Gn(0, $r, f) : 0, p = this.sample(f);
    o && c && c1(o, c, p), s.setWithVelocity(this.sample(f - h * Math.sign(d)), p, h / Math.abs(d || 1));
  }
}
const ev = (i, a) => a === "zIndex" ? !1 : !!(typeof i == "number" || Array.isArray(i) || typeof i == "string" && // It's animatable if we have a string
(dn.test(i) || i === "0") && // And it contains numbers and/or colors
!i.startsWith("url("));
function e2(i) {
  const a = i[0];
  if (i.length === 1)
    return !0;
  for (let s = 0; s < i.length; s++)
    if (i[s] !== a)
      return !0;
}
function n2(i, a, s, o) {
  const c = i[0];
  if (c === null)
    return !1;
  if (a === "display" || a === "visibility")
    return !0;
  const d = i[i.length - 1], f = ev(c, a), h = ev(d, a);
  return !f || !h ? !1 : e2(i) || (s === "spring" || h1(s)) && o;
}
function Zd(i) {
  i.duration = 0, i.type = "keyframes";
}
const Kd = /* @__PURE__ */ new Set([
  "opacity",
  "clipPath",
  "filter",
  "transform"
]), i2 = /^(?:oklch|oklab|lab|lch|color|color-mix|light-dark)\(/;
function a2(i) {
  for (let a = 0; a < i.length; a++)
    if (typeof i[a] == "string" && i2.test(i[a]))
      return !0;
  return !1;
}
const g1 = ({ mixer: i, keyframes: a }) => i && typeof a[0] != "number" && a.some((s, o) => o && i(a[o - 1], s)), nv = /* @__PURE__ */ new Set([
  "color",
  "backgroundColor",
  "outlineColor",
  "fill",
  "stroke",
  "borderColor",
  "borderTopColor",
  "borderRightColor",
  "borderBottomColor",
  "borderLeftColor"
]), y1 = () => !Mn.useManualTiming && Object.hasOwnProperty.call(Element.prototype, "animate");
function l2(i) {
  var y;
  const { motionValue: a, name: s, repeatDelay: o, repeatType: c, damping: d, type: f, keyframes: h } = i;
  if (!s || !(Kd.has(s) || nv.has(s)))
    return !1;
  const p = (y = a == null ? void 0 : a.owner) == null ? void 0 : y.current;
  if (!(p instanceof HTMLElement) && !(p instanceof SVGElement))
    return !1;
  const { onUpdate: g, transformTemplate: v } = a.owner.getProps();
  return y1() && /**
   * Force WAAPI for color properties with browser-only color formats
   * (oklch, oklab, lab, lch, etc.) that the JS animation path can't parse.
   */
  (Kd.has(s) || nv.has(s) && a2(h)) && (s !== "transform" || !v) && /**
   * If we're outputting values to onUpdate then we can't use WAAPI as there's
   * no way to read the value from WAAPI every frame.
   */
  !g && !o && c !== "mirror" && d !== 0 && f !== "inertia" && !g1(i);
}
const Lh = (i, a) => a && typeof i == "number" ? a.transform(i) : i, s2 = {
  x: "translateX",
  y: "translateY",
  z: "translateZ",
  transformPerspective: "perspective"
}, o2 = si.length, iv = {}, kd = (i, a, s = Lh(a, s1[i])) => (iv[i] || (iv[i] = (s2[i] || i) + "(")) + s + ")", Pd = (i, a) => (typeof a == "number" ? a : parseFloat(a)) === (i.startsWith("scale") ? 1 : 0);
function r2(i, a, s) {
  let o = "";
  for (let d = 0; d < o2; d++) {
    const f = si[d], h = i[f];
    if (h === void 0)
      continue;
    const p = s && (a[f] = Lh(h, zh[f]));
    Pd(f, h) || (o += kd(f, h, p || void 0) + " ");
  }
  const c = i.pathRotation;
  return c && (o += kd("rotate", c)), o = o.trim(), s ? s(a, o) : o || "none";
}
const Cl = /* @__PURE__ */ new WeakMap(), u2 = 200, v1 = 1e-3, c2 = 0.1, f2 = 1e-3, d2 = 100, av = 100, h2 = /* @__PURE__ */ new Set(["linear", "easeIn", "easeOut", "easeInOut"]), m2 = (i) => h2.has(i), lv = /* @__PURE__ */ new WeakMap(), p2 = (i, a) => {
  let s = lv.get(i);
  return (s == null ? void 0 : s[0]) !== a && (s = [
    a,
    "linear(" + Ks(Array(a + 1)).map((o) => Ps(i(o)) + " " + Ps(o * 100) + "%") + ")"
  ], lv.set(i, s)), s[1];
}, sv = (i, a) => Math.min(u2, Math.max(2, Math.ceil((a - i) / $r))), js = (i, a) => Math.abs(i - a) <= v1, gd = (i, a) => i - a, ov = (i, a, s) => Ks(Array(s + 1)).map((o) => Jt(i, a, o)), Hr = (i) => i.motionValue.owner, tu = (i) => Cl.get(i), rv = ({ state: i }) => i === "idle" || i === "finished", Tl = (i, a) => {
  var s;
  return i.latestValues ? i.latestValues[a] : (s = i.getValue(a)) == null ? void 0 : s.get();
}, g2 = ({ name: i, motionValue: a }) => {
  var s;
  return i && si.includes(i) && ((s = a == null ? void 0 : a.owner) == null ? void 0 : s.current) instanceof HTMLElement && y1() && Vh();
};
function y2(i) {
  var c;
  const a = Hr(i), { onUpdate: s, transformTemplate: o } = a.getProps();
  return (
    /**
     * A handoff from an optimised appear animation is already running
     * on its own WAAPI animation. onUpdate needs every value, every
     * frame.
     */
    !i.isHandoff && !s && !i.hasOnUpdate && /**
     * transformTemplate could output anything.
     */
    !o && i.type !== "inertia" && /**
     * A literal transform, or pathRotation, replaces or adds to the
     * transform we'd build. styleEffect builds its own as "none".
     */
    (Tl(a, "transform") || "none") === "none" && !Tl(a, "pathRotation") && /**
     * Layout animations write transform every frame.
     */
    !((c = a.projection) != null && c.isProjecting()) && /**
     * A mixer that blends these values makes them every frame. It's
     * asked last, as it's user code.
     */
    !g1(i)
  );
}
class v2 {
  constructor(a, s, o, c) {
    this.element = a, this.update = s, this.makeDriver = o, this.animation = c;
  }
  get js() {
    return this.driver || (this.driver = this.makeDriver(this.update));
  }
  now() {
    return this.driver || this.makeDriver !== Ch ? this.js.now() : le.isProcessing ? le.timestamp : Gt.now();
  }
  /**
   * keepAlive is false when seeking. Seeking the WAAPI animation is
   * free, but if a seek needs a rebuild and keeps happening, the group
   * moves to the main thread.
   */
  start(a = !0) {
    const s = tu(this.element);
    !s || s.isJS ? this.js.start(a) : s.schedule(!1, !a);
  }
  stopJS() {
    var a;
    (a = this.driver) == null || a.stop();
  }
  stop() {
    this.stopJS();
    const a = tu(this.element);
    a && !a.isFinishing && a.release(this.animation);
  }
}
let uv;
class b2 extends wl {
  constructor(a) {
    const s = Hr(a).current, { driver: o = Ch } = a;
    let c;
    const d = y2(a);
    a.driver = (p) => new v2(s, p, o, c), super(a), c = this;
    const f = this.driver;
    f && (f.animation = this), this.canAccelerate = d;
    const { stop: h } = this;
    this.stop = () => {
      this.isAccelerated() && this.sync(), h();
    };
  }
  /**
   * Each keyframe's offset, made once for the keyframes rather than on
   * every build.
   */
  offsets() {
    const { keyframes: a, times: s } = this.options;
    return s || (this.offsetsOf !== a && (this.offsetsOf = a, this.cachedOffsets = Ks(a)), this.cachedOffsets);
  }
  get group() {
    return tu(Hr(this.options).current);
  }
  get js() {
    var a;
    return (a = this.driver) == null ? void 0 : a.js;
  }
  stopJS() {
    var a;
    (a = this.driver) == null || a.stopJS();
  }
  get name() {
    return this.options.name;
  }
  /**
   * When this stops moving, or, if it repeats forever, when it starts
   * repeating, and how long each repeat takes. Held (paused, or at
   * speed 0) animations never stop moving.
   */
  timing() {
    const { startTime: a, speed: s, totalDuration: o } = this, { delay: c = 0, repeatType: d } = this.options;
    return this.holdTime !== null ? [1 / 0, 0] : o === 1 / 0 ? [
      a + c / s,
      this.resolvedDuration * (d === "loop" ? 1 : 2) / s || 1
    ] : [a + (c + o) / s, 0];
  }
  /**
   * Whether this is running, or paused, on the compositor.
   */
  isAccelerated() {
    const { group: a, state: s } = this;
    return (a == null ? void 0 : a.tracks.has(this)) && !a.isJS && this.canAccelerate && (s === "running" || s === "paused");
  }
  /**
   * The value now, while this runs on the compositor and so doesn't
   * set its motion value every frame.
   */
  liveValue() {
    return this.isAccelerated() ? this.sampleAt(Gt.now()) : void 0;
  }
  /**
   * If this moves between two keyframes only, holding still either side
   * of them, as each value of a sequence segment does, when it starts
   * and stops moving, and its easing: as a string if WAAPI runs it
   * exactly, otherwise its function, to trace.
   */
  tween() {
    const { keyframes: a, type: s, repeat: o, delay: c = 0 } = this.options;
    let d = -1;
    if (o || s !== ji || this.holdTime !== null)
      return;
    for (let g = 1; g < a.length; g++)
      if (a[g] !== a[g - 1]) {
        if (d >= 0)
          return;
        d = g - 1;
      }
    let { ease: f } = this.options;
    /* @__PURE__ */ Gb(f) && (f = f[d]);
    const h = this.offsets(), p = (g) => this.startTime + (c + h[g] * this.totalDuration) / this.speed;
    if (d >= 0) {
      const g = /* @__PURE__ */ Th(f) ? Sl(f) : m2(f) ? Qd[f] : Nd(f);
      return [
        p(d),
        p(d + 1),
        typeof g == "string" || js(g(0), 0) && js(g(1), 1) ? g : void 0
      ];
    }
  }
  /**
   * The timestamps between two timestamps where this reaches a
   * keyframe or starts a repeat, where it can turn or jump.
   */
  boundaries(a, s) {
    const { startTime: o, speed: c, resolvedDuration: d, options: f } = this, { delay: h = 0, repeat: p = 0, repeatDelay: g = 0, repeatType: v, type: y } = f, S = (y || ji) === ji ? this.offsets() : [0, 1], E = o + h / c, A = [];
    if (this.holdTime !== null || !(d > 0))
      return A;
    for (let w = Math.max(0, Math.floor((a - E) * c / d)); w <= p; w++) {
      const M = E + w * d / c;
      if (M > s)
        break;
      for (const C of S) {
        const N = M + (w % 2 && v && v !== "loop" ? 1 - C : C) * (d - g) / c;
        N > a && N < s && A.push(N);
      }
    }
    return A;
  }
  /**
   * The value at a timestamp, as a number.
   */
  numberAt(a) {
    return parseFloat(this.sampleAt(a, !0));
  }
  /**
   * Write the current value, and velocity, to the motion value.
   */
  sync() {
    const a = Gt.now(), s = this.sampleAt(a, !0);
    this.options.motionValue.setWithVelocity(this.holdTime === null ? this.sampleAt(a - $r, !0) : s, s, $r);
  }
  play() {
    this.isStopped || ((this.group || T2(Hr(this.options))).tracks.add(this), super.play());
  }
  pause() {
    super.pause(), this.isAccelerated() && this.group.schedule(!1);
  }
  /**
   * JSAnimation finishes on its next tick, which only happens once the
   * group is on the main thread, so finish now. That includes an
   * animation that can't be accelerated but reached its end before the
   * group could move there.
   */
  complete() {
    super.complete();
    const { group: a } = this;
    a && !a.isJS && this.tick(Gt.now());
  }
  /**
   * Without a tick to rebase it, a held time still includes the delay,
   * so take it off here, as a JS animation does on its next tick.
   */
  get time() {
    return this.isAccelerated() ? /* @__PURE__ */ $e(Gn(0, this.totalDuration, this.at(Gt.now()) - (this.options.delay || 0))) : super.time;
  }
  /**
   * Calls JSAnimation's setter directly, as `super.time =` is a slow
   * path in V8 and this runs for every animation of a seeked sequence.
   */
  set time(a) {
    (uv ?? (uv = Object.getOwnPropertyDescriptor(wl.prototype, "time").set)).call(this, a);
  }
  /**
   * Scroll timelines set time every frame, so run these on the main
   * thread.
   */
  attachTimeline(a) {
    var s;
    return this.canAccelerate = !1, (s = this.group) == null || s.demote(!0), super.attachTimeline(a);
  }
}
let Ns;
const S2 = (i) => {
  Ns || queueMicrotask(() => {
    const a = Ns;
    Ns = void 0, a.forEach((s) => s());
  }), (Ns || (Ns = [])).push(i);
};
function T2(i) {
  const a = i.current, s = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Map();
  let c = {}, d = [], f = /* @__PURE__ */ new Map(), h = [], p = !1, g = !1, v = !1, y = !1, S = -1 / 0, E, A = 1 / 0, w;
  const M = (L) => {
    for (const K of s)
      if (K.name === L)
        return !0;
  }, C = (L, K) => {
    const $ = {};
    for (const tt of L === void 0 ? si : d) {
      const T = o.get(tt), U = L === void 0 ? Tl(i, tt) : T ? T.sampleAt(K > L && !T.timing()[1] ? K : L) : c[tt];
      U !== void 0 && ($[tt] = U);
    }
    return $;
  }, N = (L, K) => {
    let $ = "";
    for (const tt in L) {
      const T = L[tt];
      (!K || !Pd(tt, T)) && ($ += kd(tt, T) + " ");
    }
    return (K ? $.trim() : $) || "none";
  }, H = (L, K) => N(C(L, K)), X = (L = C()) => {
    a.style.transform = N(L, !0);
  }, I = (L) => {
    L.onfinish = L.oncancel = null, L.cancel();
  }, et = (L = !0) => {
    clearTimeout(E), A = 1 / 0, w = void 0, L && X(), h.forEach(({ animation: K }) => I(K)), h = [];
  }, z = (L, K) => new Animation(new KeyframeEffect(a, L, K)), D = (L, K, $ = 1 / 0) => {
    const tt = { animation: L, offset: K, end: $ };
    L.startTime = Gt.now() + K, $ < 1 / 0 && (L.onfinish = () => {
      tt.isDone = !0, h.some((T) => T.end === 1 / 0) && (I(L), h = h.filter((T) => T !== tt)), nt.schedule(!1);
    }), L.oncancel = () => h.includes(tt) && nt.demote(), h.push(tt);
  }, at = (L, K, $) => {
    const tt = (U, k) => Math.abs(L(k) - L(U)), T = tt(K, $);
    for (; $ - K > 0.01; ) {
      const U = (K + $) / 2;
      tt(K, U) > tt(U, $) ? $ = U : K = U;
    }
    return tt(K, $) > T / 2 ? [K, $] : [];
  }, lt = (L, K, $, tt) => {
    const T = sv(K, $);
    if (tt.length * 4 > T)
      return;
    let U;
    for (const G of L) {
      const ct = G.numberAt(K), Tt = (G.numberAt((K + $) / 2) - ct) / (G.numberAt($) - ct);
      if (Tt === Tt) {
        if (U === void 0)
          U = Tt;
        else if (!js(Tt, U))
          return;
      }
    }
    const k = ov(K, $, T).concat(tt).sort(gd), J = (G) => /* @__PURE__ */ Ea(K, $, G);
    let it, W;
    for (const G of L) {
      const ct = G.numberAt(K), Tt = k.map((Mt) => G.numberAt(Mt) - ct), Xt = Tt[Tt.length - 1], Ht = Tt.some((Mt) => Math.abs(Mt) * v1 > Math.abs(Xt)) ? 0 : Xt, Ut = Tt.map((Mt) => Ht ? Mt / Ht : Mt);
      if (Ht && !it)
        it = Ut, W = (Mt) => (G.numberAt(Mt) - ct) / Ht;
      else if (Ut.some((Mt, ie) => !js(Mt, Ht && it[ie])))
        return;
    }
    if (!it || it.every((G, ct) => js(G, J(k[ct]))))
      return "linear";
    const ft = [], P = (G, ct = W(G)) => ft.push(Ps(ct) + " " + Ps(J(G) * 100) + "%");
    return it.forEach((G, ct) => {
      ct && Math.abs(G - it[ct - 1]) > 0.2 && at(W, k[ct - 1], k[ct]).forEach((Tt) => P(Tt)), P(k[ct], G);
    }), "linear(" + ft + ")";
  }, st = (L, K, $, tt) => {
    const T = [K], U = [];
    let k = $, J = K;
    for (const G of L) {
      const ct = G.tween();
      if ((ct == null ? void 0 : ct[2]) !== "linear") {
        const [Tt, Xt] = G.timing(), [Ht, Ut] = ct || [K, Xt ? $ : Tt];
        k = Math.min(k, Ht), J = Math.max(J, Ut), U.push(G);
      }
    }
    k = Math.max(K, k), J = Math.min($, J);
    const it = (G, ct) => U.every((Tt) => !(Math.abs(Tt.numberAt((G + ct) / 2) - (Tt.numberAt(G) + Tt.numberAt(ct)) / 2) > (Tt.name.startsWith("scale") ? f2 : c2))), W = (G, ct, Tt) => {
      if (ct - G < 1 || it(G, ct))
        T.push(ct);
      else if (Tt < 4)
        W(G, (G + ct) / 2, Tt + 1), W((G + ct) / 2, ct, Tt + 1);
      else {
        for (const Xt of L)
          T.push(...at((Ht) => Xt.numberAt(Ht), G, ct));
        T.push(ct);
      }
    }, ft = J > k ? ov(k, J, Math.ceil((J - k) / 100)) : [];
    ft.push($);
    for (const G of tt)
      ft.push(G, Math.min(G + 0.01, $));
    let P = K;
    for (const G of ft.sort(gd))
      G > P && W(P, G, 0), P = G;
    return T.sort(gd);
  }, dt = (L) => {
    let K;
    for (const $ of L) {
      const tt = $.tween();
      if (!tt || K && (Math.abs(tt[0] - K[0]) > 1 || Math.abs(tt[1] - K[1]) > 1))
        return;
      K = [
        tt[0],
        tt[1],
        !K || tt[2] === K[2] ? tt[2] : void 0
      ];
    }
    return K;
  }, vt = (L, K, $, tt, T = { fill: "both" }, U) => {
    const k = tt ? [] : L.flatMap((P) => P.boundaries(K, $)), J = tt || lt(L, K, $, k), it = J ? [K, $] : st(L, K, $, k), W = it.map((P) => H(P, U));
    let ft = { transform: W };
    return J || (ft.offset = it.map((P) => /* @__PURE__ */ Ea(K, $, P))), W.every((P) => P === W[0]) && (X(C(K, U)), ft = null), z(ft, {
      ...T,
      duration: $ - K,
      easing: J || "linear"
    });
  }, xt = (L) => {
    const K = Gt.now() + L;
    K < A && (clearTimeout(E), A = K, E = setTimeout(() => {
      A = 1 / 0, nt.schedule(!1);
    }, L));
  }, St = (L) => {
    let K = L, $ = 0, tt = 0;
    const T = [], U = [], k = /* @__PURE__ */ new Set();
    o.clear(), f = /* @__PURE__ */ new Map();
    for (const it of s) {
      o.set(it.name, it);
      const [W, ft] = it.timing(), P = W === 1 / 0;
      if (f.set(it, [it.at(L), it.speed, P]), !P) {
        if (it.speed < 0)
          return;
        if (ft) {
          if ($) {
            const G = (W - tt) / ft;
            if (Math.abs(ft - $) > 1 || Math.abs(G - Math.round(G)) * $ > 1)
              return;
          } else
            $ = ft, tt = W;
          U.push(it);
        } else
          k.add(W);
        T.push(it), K = Math.max(K, W);
      }
    }
    c = {}, d = si.filter((it) => {
      if (o.has(it))
        return !0;
      const W = c[it] = Tl(i, it);
      return W !== void 0 && !Pd(it, W);
    }), et(!1);
    const J = !$ && dt(T);
    try {
      if (K > L) {
        let it;
        if (J && J[1] > L) {
          const [W, ft, P] = J;
          if (W - L > av)
            return T.forEach((G) => G.sync()), xt(w = W - L - av), !0;
          it = typeof P == "string" ? P : P ? p2(P, sv(W, ft)) : lt(T, W, ft, []), it && D(vt(T, W, ft, it, {
            fill: "both",
            endDelay: K - ft
          }), W - L, K - W);
        }
        it || D(vt(T, L, K), 0, K - L), k.forEach((W) => W < K - 1 && D(z(null, { duration: W - L }), 0, W - L));
      }
      if ($) {
        const it = tt + Math.floor((K - tt) / $) * $;
        D(vt(U, it, it + $, void 0, {
          iterations: 1 / 0,
          iterationStart: (K - it) / $,
          /**
           * It must not fill backwards over the finite part
           * that runs before it.
           */
          fill: "forwards"
        }, K), K - L);
      }
    } catch {
      return;
    }
    return h.length || et(), !0;
  }, F = (L, K) => {
    let $, tt = 0;
    for (const T of s) {
      const U = f.get(T);
      if (!U)
        return !1;
      const [k, J, it] = U, W = T.at(L), ft = T.timing()[0] === 1 / 0;
      if (it) {
        if (ft && (W === k || !h.length))
          continue;
        return !1;
      }
      const P = (W - k) / J, G = ft ? 0 : T.speed / J;
      if ($ === void 0)
        $ = P, tt = G;
      else if (Math.abs(P - $) > 1 || G !== tt)
        return !1;
    }
    if ($ === void 0)
      return !0;
    if (!h.length) {
      if (w === void 0 || K && tt)
        return !1;
      if (tt) {
        const T = (w - $) / tt;
        if (T < 1)
          return !1;
        xt(T);
      }
      return !0;
    }
    for (const { offset: T, end: U, isDone: k } of h) {
      const J = $ - T;
      if (U < 1 / 0 && (k ? J < U - 1 : J < 0 && (K || T <= 0) || J >= U))
        return !1;
    }
    for (const { animation: T, offset: U, isDone: k } of h) {
      if (k)
        continue;
      const J = $ - U;
      tt && T.updatePlaybackRate && T.playState === "running" && Math.abs(Number(T.currentTime) - J) < 20 ? T.playbackRate !== tt && T.updatePlaybackRate(tt) : tt ? (T.playbackRate !== tt && (T.playbackRate = tt), T.startTime = L - J / tt) : (T.startTime = null, T.currentTime = J);
    }
    return !0;
  }, rt = () => s.size ? !1 : (v = !0, tu(a) === nt && Cl.delete(a), nt.isJS || et(), !0), ut = () => {
    const L = Gt.now();
    if (nt.isJS || (nt.isFinishing = !0, s.forEach((tt) => {
      const [T, U] = tt.timing();
      tt.state === "running" && tt.speed > 0 && !U && T <= L + 1 && (tt.complete(), c[tt.name] = Tl(i, tt.name), f.has(tt) || (p = !0));
    }), nt.isFinishing = !1), g = !1, v || (s.forEach((tt) => rv(tt) && s.delete(tt)), rt()))
      return;
    for (const tt of s)
      if (!tt.canAccelerate)
        return nt.demote(!0);
    nt.isJS && (nt.isJS = !1, p = !0, s.forEach((tt) => tt.stopJS()));
    const K = p, $ = y;
    if (p = y = !1, K || !F(L, $)) {
      if ($) {
        if (L - S < d2)
          return nt.demote();
        S = L;
      }
      if (!St(L))
        return nt.demote();
    } else if (w !== void 0 && !$)
      return;
    s.forEach((tt) => tt.timing()[0] === 1 / 0 && tt.sync());
  }, nt = {
    tracks: s,
    isJS: !1,
    isFinishing: !1,
    schedule(L, K) {
      v || (p || (p = L), y || (y = !!K), g || (g = !0, le.isProcessing ? qt.render(ut, !1, !0) : S2(ut)));
    },
    /**
     * End the group now, rather than when it next builds, so the
     * element's transform is the caller's again as soon as its last
     * animation is stopped.
     */
    release(L) {
      rv(L) && s.delete(L), rt() || nt.schedule(!0);
    },
    /**
     * An outside write. Rebuild once, but if it keeps happening, move
     * to the main thread.
     */
    check() {
      if (!nt.isJS) {
        for (const L in c)
          if (Tl(i, L) !== c[L] && !M(L))
            return nt.schedule(!0, !0);
      }
    },
    demote(L) {
      if (!(nt.isJS || v))
        return s.forEach((K) => {
          K.isAccelerated() && K.sync(), L || (K.canAccelerate = !1);
        }), nt.isJS = !0, f = /* @__PURE__ */ new Map(), et(), s.forEach((K) => {
          var $;
          return K.state === "running" && (($ = K.js) == null ? void 0 : $.start());
        }), !0;
    }
  };
  return Cl.set(a, nt), nt;
}
class E2 extends Oh {
  constructor(a) {
    var p;
    super(), this.stop = () => {
      var g, v;
      this._animation && (this._animation.stop(), (g = this.stopTimeline) == null || g.call(this)), (v = this.keyframeResolver) == null || v.cancel();
    }, this.createdAt = Gt.now();
    const { keyframes: s, name: o, motionValue: c, element: d } = a, f = a;
    f.autoplay ?? (f.autoplay = !0), f.delay ?? (f.delay = 0), f.type ?? (f.type = "keyframes"), f.repeat ?? (f.repeat = 0), f.repeatDelay ?? (f.repeatDelay = 0), f.repeatType ?? (f.repeatType = "loop");
    const h = (d == null ? void 0 : d.KeyframeResolver) || _h;
    this.keyframeResolver = new h(s, (g, v, y) => this.onKeyframesResolved(g, v, f, !y), o, c, d), (p = this.keyframeResolver) == null || p.scheduleResolve();
  }
  onKeyframesResolved(a, s, o, c) {
    var M, C;
    this.keyframeResolver = void 0;
    const { name: d, type: f, velocity: h, delay: p, isHandoff: g, onUpdate: v } = o;
    this.resolvedAt = Gt.now();
    const y = n2(a, d, f, h);
    y || ((Mn.instantAnimations || !p) && (v == null || v(ks(a, o, s))), a[0] = a[a.length - 1], Zd(o), o.repeat = 0);
    const { onComplete: S } = o;
    o.finalKeyframe = s, o.keyframes = a, o.onComplete = () => {
      S == null || S(), this.notifyFinished();
    };
    const E = y && !g && l2(o), A = !E && g2(o);
    c && (E || A || this.resolvedAt !== this.createdAt) && (o.startTime ?? (o.startTime = i1(this.createdAt, this.resolvedAt)));
    let w;
    if (E) {
      o.element = (C = (M = o.motionValue) == null ? void 0 : M.owner) == null ? void 0 : C.current;
      try {
        w = new t2(o);
      } catch {
        w = new wl(o);
      }
    } else A ? w = new b2(o) : w = new wl(o);
    this.pendingTimeline && (this.stopTimeline = w.attachTimeline(this.pendingTimeline), this.pendingTimeline = void 0), this._animation = w;
  }
  get finished() {
    return this._animation ? this._animation.finished : super.finished;
  }
  then(a, s) {
    return this.finished.finally(a).then(() => {
    });
  }
  /**
   * The value now, if the animation runs on the compositor.
   */
  liveValue() {
    var a, s;
    return (s = (a = this._animation) == null ? void 0 : a.liveValue) == null ? void 0 : s.call(a);
  }
  get animation() {
    var a;
    return this._animation || ((a = this.keyframeResolver) == null || a.resume(), ZM()), this._animation;
  }
  get duration() {
    return this.animation.duration;
  }
  get iterationDuration() {
    return this.animation.iterationDuration;
  }
  get time() {
    return this.animation.time;
  }
  set time(a) {
    this.animation.time = a;
  }
  get speed() {
    return this.animation.speed;
  }
  get state() {
    return this.animation.state;
  }
  set speed(a) {
    this.animation.speed = a;
  }
  get startTime() {
    return this.animation.startTime;
  }
  attachTimeline(a) {
    return this._animation ? this.stopTimeline = this.animation.attachTimeline(a) : this.pendingTimeline = a, () => this.stop();
  }
  play() {
    this.animation.play();
  }
  pause() {
    this.animation.pause();
  }
  complete() {
    this.animation.complete();
  }
  cancel() {
    var a, s;
    (a = this._animation) == null || a.cancel(), (s = this.keyframeResolver) == null || s.cancel();
  }
}
function b1(i, a, s, o = 0, c = 1) {
  const d = Array.from(i).sort((g, v) => g.sortNodePosition(v)).indexOf(a), f = i.size, h = (f - 1) * o;
  return typeof s == "function" ? s(d, f) : c === 1 ? d * o : h - d * o;
}
const cv = 30, A2 = (i) => !isNaN(parseFloat(i));
class x2 {
  /**
   * @param init - The initiating value
   * @param config - Optional configuration options
   *
   * -  `transformer`: A function to transform incoming values with.
   */
  constructor(a, s = {}) {
    this.canTrackVelocity = null, this.events = {}, this.updateAndNotify = (o) => {
      const c = Gt.now();
      if (this.updatedAt !== c && this.setPrevFrameValue(), this.prev = this.current, this.setCurrent(o), this.current !== this.prev && (this.dirty(), this.dependents))
        for (const d of this.dependents)
          d.dirty();
    }, this.hasAnimated = !1, this.setCurrent(a), this.owner = s.owner;
  }
  setCurrent(a) {
    this.current = a, this.updatedAt = Gt.now(), this.canTrackVelocity === null && a !== void 0 && (this.canTrackVelocity = A2(this.current));
  }
  setPrevFrameValue(a = this.current) {
    this.prevFrameValue = a, this.prevUpdatedAt = this.updatedAt;
  }
  /**
   * Adds a function that will be notified when the `MotionValue` is updated.
   *
   * It returns a function that, when called, will cancel the subscription.
   *
   * When calling `onChange` inside a React component, it should be wrapped with the
   * `useEffect` hook. As it returns an unsubscribe function, this should be returned
   * from the `useEffect` function to ensure you don't add duplicate subscribers..
   *
   * ```jsx
   * export const MyComponent = () => {
   *   const x = useMotionValue(0)
   *   const y = useMotionValue(0)
   *   const opacity = useMotionValue(1)
   *
   *   useEffect(() => {
   *     function updateOpacity() {
   *       const maxXY = Math.max(x.get(), y.get())
   *       const newOpacity = transform(maxXY, [0, 100], [1, 0])
   *       opacity.set(newOpacity)
   *     }
   *
   *     const unsubscribeX = x.on("change", updateOpacity)
   *     const unsubscribeY = y.on("change", updateOpacity)
   *
   *     return () => {
   *       unsubscribeX()
   *       unsubscribeY()
   *     }
   *   }, [])
   *
   *   return <motion.div style={{ x }} />
   * }
   * ```
   *
   * @param subscriber - A function that receives the latest value.
   * @returns A function that, when called, will cancel this subscription.
   *
   * @deprecated
   */
  onChange(a) {
    return this.on("change", a);
  }
  on(a, s) {
    var o;
    return a === "change" ? this.onChangeSubscribe(s) : ((o = this.events)[a] || (o[a] = new Jr())).add(s);
  }
  onChangeSubscribe(a) {
    const { events: s } = this;
    return !s.change && !this.changeSubscriber ? this.changeSubscriber = a : (s.change || (s.change = new Jr(), s.change.add(this.changeSubscriber), this.changeSubscriber = void 0), s.change.add(a)), () => {
      var o;
      this.changeSubscriber === a ? this.changeSubscriber = void 0 : (o = s.change) == null || o.remove(a), this.stopIfUnobserved();
    };
  }
  /**
   * If we have no more change listeners by the start
   * of the next frame, stop active animations.
   */
  stopIfUnobserved() {
    qt.read(() => {
      var a;
      !this.changeSubscriber && !((a = this.events.change) != null && a.getSize()) && this.stop();
    });
  }
  clearListeners() {
    this.changeSubscriber = void 0;
    for (const a in this.events)
      this.events[a].clear();
  }
  /**
   * Attaches a passive effect to the `MotionValue`.
   */
  attach(a, s) {
    this.passiveEffect = a, this.stopPassiveEffect = s;
  }
  /**
   * Sets the state of the `MotionValue`.
   *
   * @remarks
   *
   * ```jsx
   * const x = useMotionValue(0)
   * x.set(10)
   * ```
   *
   * @param latest - Latest value to set.
   * @param render - Whether to notify render subscribers. Defaults to `true`
   *
   * @public
   */
  set(a) {
    this.passiveEffect ? this.passiveEffect(a, this.updateAndNotify) : this.updateAndNotify(a);
  }
  setWithVelocity(a, s, o) {
    this.set(s), this.prev = void 0, this.prevFrameValue = a, this.prevUpdatedAt = this.updatedAt - o;
  }
  /**
   * Set the state of the `MotionValue`, stopping any active animations,
   * effects, and resets velocity to `0`.
   */
  jump(a, s = !0) {
    var o;
    s && (this.updatedAt = Gt.now(), this.stop()), this.updateAndNotify(a), this.prev = a, this.prevUpdatedAt = this.prevFrameValue = void 0, (o = this.stopPassiveEffect) == null || o.call(this);
  }
  dirty() {
    var o;
    const { current: a, changeSubscriber: s } = this;
    s ? s(a) : (o = this.events.change) == null || o.notify(a);
  }
  addDependent(a) {
    (this.dependents || (this.dependents = /* @__PURE__ */ new Set())).add(a);
  }
  removeDependent(a) {
    var s;
    (s = this.dependents) == null || s.delete(a);
  }
  /**
   * Returns the latest state of `MotionValue`
   *
   * @returns - The latest state of `MotionValue`
   *
   * @public
   */
  get() {
    var s, o;
    const a = (o = (s = this.animation) == null ? void 0 : s.liveValue) == null ? void 0 : o.call(s);
    return a === void 0 ? this.current : a;
  }
  /**
   * The value as last set. Unlike get(), this doesn't read an animation
   * running on the compositor, which renders the value itself.
   */
  getCurrent() {
    return this.current;
  }
  /**
   * @public
   */
  getPrevious() {
    return this.prev;
  }
  /**
   * Returns the latest velocity of `MotionValue`
   *
   * @returns - The latest velocity of `MotionValue`. Returns `0` if the state is non-numerical.
   *
   * @public
   */
  getVelocity() {
    const a = Gt.now();
    if (!this.canTrackVelocity || this.prevFrameValue === void 0 || a - this.updatedAt > cv)
      return 0;
    const s = Math.min(this.updatedAt - this.prevUpdatedAt, cv);
    return /* @__PURE__ */ Nb(parseFloat(this.current) - parseFloat(this.prevFrameValue), s);
  }
  /**
   * Registers a new animation to control this `MotionValue`. Only one
   * animation can drive a `MotionValue` at one time.
   *
   * ```jsx
   * value.start()
   * ```
   *
   * @param animation - A function that starts the provided animation
   */
  start(a) {
    return new Promise((s) => this.run(a, s));
  }
  /**
   * As start(), without making a promise, for animations started
   * internally, which complete through their own controls.
   */
  run(a, s) {
    var d;
    this.stop(), this.hasAnimated = !0;
    let o = !1, c;
    c = a(() => {
      var f;
      o = !0, (f = this.events.animationComplete) == null || f.notify(), this.animation === c && (this.animation = void 0), s == null || s();
    }), o || (this.animation = c), (d = this.events.animationStart) == null || d.notify();
  }
  /**
   * Stop the currently active animation.
   *
   * @public
   */
  stop() {
    var a;
    this.animation && (this.animation.stop(), (a = this.events.animationCancel) == null || a.notify()), this.animation = void 0;
  }
  /**
   * Returns `true` if this value is currently animating.
   *
   * @public
   */
  isAnimating() {
    return !!this.animation;
  }
  /**
   * Destroy and clean up subscribers to this `MotionValue`.
   *
   * The `MotionValue` hooks like `useMotionValue` and `useTransform` automatically
   * handle the lifecycle of the returned `MotionValue`, so this method is only necessary if you've manually
   * created a `MotionValue` via the `motionValue` function.
   *
   * @public
   */
  destroy() {
    var a, s, o;
    (a = this.dependents) == null || a.clear(), (s = this.events.destroy) == null || s.notify(), this.clearListeners(), this.stop(), (o = this.stopPassiveEffect) == null || o.call(this);
  }
}
function Aa(i, a) {
  return new x2(i, a);
}
function S1(i, a) {
  if (i != null && i.inherit && a) {
    const { inherit: s, ...o } = i;
    return { ...a, ...o };
  }
  return i;
}
function Uh(i, a) {
  const s = (i == null ? void 0 : i[a]) ?? (i == null ? void 0 : i.default) ?? i;
  return s !== i ? S1(s, i) : s;
}
const M2 = {
  type: "spring",
  stiffness: 500,
  damping: 25,
  restSpeed: 10
}, w2 = (i) => ({
  type: "spring",
  stiffness: 550,
  damping: i === 0 ? 2 * Math.sqrt(550) : 30,
  restSpeed: 10
}), C2 = {
  type: "keyframes",
  duration: 0.8
}, D2 = {
  type: "keyframes",
  ease: [0.25, 0.1, 0.35, 1],
  duration: 0.3
}, O2 = (i, { keyframes: a }) => a.length > 2 ? C2 : Gi.has(i) ? i.startsWith("scale") ? w2(a[1]) : M2 : D2, z2 = /* @__PURE__ */ new Set([
  "when",
  "delay",
  "delayChildren",
  "staggerChildren",
  "staggerDirection",
  "repeat",
  "repeatType",
  "repeatDelay",
  "from",
  "elapsed",
  "out",
  "mixer"
]);
function R2(i) {
  for (const a in i)
    if (!z2.has(a))
      return !0;
  return !1;
}
const Bh = (i, a, s, o = {}, c, d) => (f) => {
  const h = Uh(o, i) || {}, p = h.delay || o.delay || 0;
  let { elapsed: g = 0 } = o;
  g = g - /* @__PURE__ */ Oe(p);
  const v = {
    keyframes: Array.isArray(s) ? s : [null, s],
    ease: "easeOut",
    velocity: a.getVelocity(),
    ...h,
    delay: -g,
    onUpdate: (S) => {
      a.set(S), h.onUpdate && h.onUpdate(S);
    },
    onComplete: () => {
      f(), h.onComplete && h.onComplete();
    },
    name: i,
    motionValue: a,
    element: d ? void 0 : c,
    hasOnUpdate: !!h.onUpdate
  };
  R2(h) || Object.assign(v, O2(i, v)), v.duration && (v.duration = /* @__PURE__ */ Oe(v.duration)), v.repeatDelay && (v.repeatDelay = /* @__PURE__ */ Oe(v.repeatDelay)), v.from !== void 0 && (v.keyframes[0] = v.from);
  let y = !1;
  if ((v.type === !1 || v.duration === 0 && !v.repeatDelay) && (Zd(v), v.delay === 0 && (y = !0)), (Mn.instantAnimations || Mn.skipAnimations || c != null && c.shouldSkipAnimations || h.skipAnimations) && (y = !0, Zd(v), v.delay = 0), v.allowFlatten = !h.type && !h.ease, y && !d && a.get() !== void 0) {
    const S = ks(v.keyframes, h);
    if (S !== void 0) {
      qt.update(() => {
        v.onUpdate(S), v.onComplete();
      });
      return;
    }
  }
  return h.isSync ? new wl(v) : new E2(v);
}, N2 = (
  // eslint-disable-next-line redos-detector/no-unsafe-regex -- false positive, as it can match a lot of words
  /^var\(--(?:([\w-]+)|([\w-]+), ?([a-zA-Z\d ()%#.,-]+))\)/u
);
function _2(i) {
  const a = N2.exec(i);
  if (!a)
    return [,];
  const [, s, o, c] = a;
  return [`--${s ?? o}`, c];
}
function Hh(i, a, s = 1) {
  const [o, c] = _2(i);
  if (!o)
    return;
  const d = window.getComputedStyle(a).getPropertyValue(o);
  if (d) {
    const f = d.trim();
    return gh(f) ? parseFloat(f) : f;
  }
  return du(c) ? Hh(c, a, s + 1) : c;
}
function V2(i) {
  const a = [{}, {}];
  return i == null || i.values.forEach((s, o) => {
    a[0][o] = s.get(), a[1][o] = s.getVelocity();
  }), a;
}
function T1(i, a, s, o) {
  const c = (d) => typeof d == "function" ? d(s !== void 0 ? s : i.custom, ...V2(o)) : d;
  return a = c(a), typeof a == "string" && (a = i.variants && i.variants[a]), c(a);
}
function Sa(i, a, s) {
  return T1(i.getProps(), a, s, i);
}
const E1 = (i, a) => {
  var s;
  return a === "exit" ? (s = i.presenceContext) == null ? void 0 : s.custom : void 0;
}, A1 = /* @__PURE__ */ new Set([
  "width",
  "height",
  "top",
  "left",
  "right",
  "bottom",
  ...si
]), L2 = (i) => Array.isArray(i);
function U2(i, a, s) {
  i.hasValue(a) ? i.getValue(a).set(s) : i.addValue(a, Aa(s));
}
function B2(i) {
  return L2(i) ? i[i.length - 1] || 0 : i;
}
function H2(i, a) {
  const s = Sa(i, a);
  let { transitionEnd: o = {}, transition: c = {}, ...d } = s || {};
  d = { ...d, ...o };
  for (const f in d) {
    const h = B2(d[f]);
    U2(i, f, h);
  }
}
const me = (i) => !!(i && i.getVelocity);
function j2(i) {
  return !!(me(i) && i.add);
}
function Jd(i, a) {
  const s = i.getValue("willChange");
  if (j2(s))
    return s.add(a);
  if (!s && Mn.WillChange) {
    const o = new Mn.WillChange("auto");
    i.addValue("willChange", o), o.add(a);
  }
}
const x1 = "data-framer-appear-id";
function M1(i) {
  return i.props[x1];
}
const G2 = typeof window < "u";
function Y2({ protectedKeys: i, needsAnimating: a }, s) {
  const o = s in i && !a[s];
  return a[s] = !1, o;
}
function w1(i, a, { delay: s = 0, transitionOverride: o, type: c } = {}) {
  var A, w;
  let { transition: d, transitionEnd: f, ...h } = a;
  const p = i.getDefaultTransition();
  d = d ? S1(d, p) : p;
  const g = d == null ? void 0 : d.reduceMotion, v = d == null ? void 0 : d.skipAnimations;
  o && (d = o);
  const y = [], S = c && ((A = i.animationState) == null ? void 0 : A.getState()[c]), E = d == null ? void 0 : d.path;
  E && (E.animateValues ? E.animateValues((M) => i.getValue(M, i.latestValues[M] ?? 0), h, d, s, y) : (w = E.animateVisualElement) == null || w.call(E, i, h, d, s, y));
  for (const M in h) {
    const C = i.getValue(M, i.latestValues[M] ?? null), N = h[M];
    if (N === void 0 || S && Y2(S, M))
      continue;
    const H = {
      delay: s,
      ...Uh((S == null ? void 0 : S.out[M]) || d || {}, M)
    };
    v && (H.skipAnimations = !0);
    const X = C.get();
    if (X !== void 0 && !C.isAnimating() && !Array.isArray(N) && N === X && !H.velocity) {
      qt.update(() => C.set(N));
      continue;
    }
    let I = !1;
    if (G2 && window.MotionHandoffAnimation) {
      const D = M1(i);
      if (D) {
        const at = window.MotionHandoffAnimation(D, M, qt);
        at !== null && (H.startTime = at, I = !0);
      }
    }
    Jd(i, M);
    const et = g ?? i.shouldReduceMotion;
    C.run(Bh(M, C, N, et && A1.has(M) ? { type: !1 } : H, i, I));
    const z = C.animation;
    z && y.push(z);
  }
  if (f) {
    const M = () => qt.update(() => {
      f && H2(i, f);
    });
    y.length ? Promise.all(y).then(M) : M();
  }
  return y;
}
function Fd(i, a, s = {}) {
  const o = Sa(i, a, E1(i, s.type)), c = s.transitionOverride || ((o == null ? void 0 : o.transition) ?? (i.getDefaultTransition() || {})), d = () => Promise.all(o ? w1(i, o, s) : []), f = (p = 0) => {
    const { variantChildren: g } = i, { delayChildren: v = 0, staggerChildren: y, staggerDirection: S } = c, E = [];
    return g == null || g.forEach((A) => {
      A.notify("AnimationStart", a), E.push(Fd(A, a, {
        ...s,
        delay: p + (typeof v == "function" ? 0 : v) + b1(g, A, v, y, S)
      }).then(() => A.notify("AnimationComplete", a)));
    }), Promise.all(E);
  }, { when: h } = c;
  return h ? h === "beforeChildren" ? d().then(() => f()) : f().then(d) : Promise.all([d(), f(s.delay)]);
}
function q2(i, a, s = {}) {
  return i.notify("AnimationStart", a), (Array.isArray(a) ? Promise.all(a.map((c) => Fd(i, c, s))) : typeof a == "string" ? Fd(i, a, s) : Promise.all(w1(i, Sa(i, a, s.custom), s))).then(() => {
    i.notify("AnimationComplete", a);
  });
}
const X2 = {
  test: (i) => i === "auto",
  parse: (i) => i
}, Q2 = (i) => (a) => a.test(i), Z2 = [Ol, gt, jn, ai, jx, Hx, X2], fv = (i) => Z2.find(Q2(i));
function K2(i) {
  return typeof i == "number" ? i === 0 : i !== null ? i === "none" || i === "0" || yh(i) : !0;
}
const k2 = /* @__PURE__ */ new Set(["auto", "none", "0"]);
function P2(i, a, s) {
  let o = 0, c;
  for (; o < i.length && !c; ) {
    const d = i[o];
    typeof d == "string" && !k2.has(d) && Zx(d) && (c = i[o]), o++;
  }
  if (c && s)
    for (const d of a)
      i[d] !== c && (i[d] = Rh(s, c));
}
class J2 extends _h {
  /**
   * Passes isAsync to the base constructor rather than setting it as a
   * class field, which would compile to a constructor that spreads
   * `arguments` into super(). That spread is slow in the interpreter,
   * and animate() constructs one resolver per value.
   */
  constructor(a, s, o, c, d) {
    super(a, s, o, c, d, !0);
  }
  /**
   * Keyframes that don't need reading from the DOM, or measuring,
   * resolve straight away rather than in the frame loop's batched read.
   */
  scheduleResolve() {
    if (this.canReadNow() && (this.readKeyframes(), !this.needsMeasurement))
      return this.complete();
    super.scheduleResolve();
  }
  canReadNow() {
    const { unresolvedKeyframes: a, element: s, motionValue: o } = this, c = a[0] ?? (o == null ? void 0 : o.get());
    if (!(s != null && s.current) || c === void 0)
      return !1;
    for (let d = 0; d < a.length; d++)
      if (od(d ? a[d] : c))
        return !1;
    return !0;
  }
  readKeyframes() {
    const { unresolvedKeyframes: a, element: s, name: o } = this;
    if (!(s != null && s.current))
      return;
    super.readKeyframes();
    for (let v = 0; v < a.length; v++) {
      let y = a[v];
      if (typeof y == "string" && (y = y.trim(), du(y))) {
        const S = Hh(y, s.current);
        S !== void 0 && (a[v] = S), v === a.length - 1 && (this.finalKeyframe = y);
      }
    }
    if (this.resolveNoneKeyframes(), !A1.has(o) || a.length !== 2)
      return;
    const [c, d] = a;
    if (typeof c == "number" && typeof d == "number")
      return;
    const f = fv(c), h = fv(d), p = od(c), g = od(d);
    if (p !== g && pd[o]) {
      this.needsMeasurement = !0;
      return;
    }
    if (f !== h)
      if (I0(f) && I0(h))
        for (let v = 0; v < a.length; v++) {
          const y = a[v];
          typeof y == "string" && (a[v] = parseFloat(y));
        }
      else pd[o] && (this.needsMeasurement = !0);
  }
  resolveNoneKeyframes() {
    const { unresolvedKeyframes: a, name: s } = this, o = [];
    for (let c = 0; c < a.length; c++)
      (a[c] === null || K2(a[c])) && o.push(c);
    o.length && P2(a, o, s);
  }
  measure() {
    const { element: a, name: s } = this;
    return pd[s](window.getComputedStyle(a.current), () => a.measureViewportBox());
  }
  measureInitialState() {
    var d;
    const { element: a, unresolvedKeyframes: s, name: o } = this;
    if (!(a != null && a.current))
      return;
    o === "height" && (this.suspendedScrollY = window.pageYOffset), this.measuredOrigin = this.measure(), s[0] = this.measuredOrigin;
    const c = s[s.length - 1];
    c !== void 0 && ((d = this.motionValue) == null || d.jump(c, !1));
  }
  measureEndState() {
    var d;
    const { element: a, unresolvedKeyframes: s } = this;
    if (!(a != null && a.current))
      return;
    (d = this.motionValue) == null || d.jump(this.measuredOrigin, !1);
    const o = s.length - 1, c = s[o];
    s[o] = this.measure(), c !== null && this.finalKeyframe === void 0 && (this.finalKeyframe = c), this.resolveNoneKeyframes();
  }
}
const jh = [
  "borderTopLeftRadius",
  "borderTopRightRadius",
  "borderBottomRightRadius",
  "borderBottomLeftRadius"
];
function F2(i) {
  return Rb(i) && "offsetHeight" in i && !("ownerSVGElement" in i);
}
function Gh(i) {
  return Rb(i) && "ownerSVGElement" in i;
}
const eu = {};
function mu(i) {
  var a;
  return (a = eu.current) == null || a.add(i), i;
}
const pu = (i) => eu.current ? eu.current.bind(i) : i;
function Yh(i, a, s) {
  var o;
  if (i == null)
    return [];
  if (i instanceof EventTarget)
    return [i];
  if (typeof i == "string") {
    const d = (((o = eu.current) == null ? void 0 : o.root) || document).querySelectorAll(i);
    return d ? Array.from(d) : [];
  }
  return Array.from(i).filter((c) => c != null);
}
function C1(i) {
  return i.replace(/([A-Z])/g, (a) => `-${a.toLowerCase()}`);
}
function qh(i, a, s) {
  const { style: o, vars: c, transformOrigin: d } = i;
  let f = !1, h = !1;
  for (const p in a) {
    const g = a[p];
    if (Gi.has(p)) {
      f = !0;
      continue;
    } else if (qb(p)) {
      c[p] = g;
      continue;
    } else {
      const v = Lh(g, zh[p]);
      p.startsWith("origin") ? (h = !0, d[p] = v) : o[p] = v;
    }
  }
  if (a.transform || (f || s ? o.transform = r2(a, i.transform, s) : o.transform && (o.transform = "none")), h) {
    const { originX: p = "50%", originY: g = "50%", originZ: v = 0 } = d;
    o.transformOrigin = `${p} ${g} ${v}`;
  }
}
const I2 = {
  offset: "stroke-dashoffset",
  array: "stroke-dasharray"
}, W2 = {
  offset: "strokeDashoffset",
  array: "strokeDasharray"
};
function $2(i, a, s = 1, o = 0, c = !0) {
  i.pathLength = 1;
  const d = c ? I2 : W2;
  i[d.offset] = `${-o}`, i[d.array] = `${a} ${s}`;
}
const D1 = [
  "transform",
  "opacity",
  "clipPath",
  "filter",
  "offsetDistance",
  "offsetPath",
  "offsetRotate",
  "offsetAnchor"
];
function O1(i, {
  attrX: a,
  attrY: s,
  attrScale: o,
  pathLength: c,
  pathSpacing: d = 1,
  pathOffset: f = 0,
  // This is object creation, which we try to avoid per-frame.
  ...h
}, p, g, v) {
  if (qh(i, h, g), p) {
    i.style.viewBox && (i.attrs.viewBox = i.style.viewBox);
    return;
  }
  i.attrs = i.style, i.style = {};
  const { attrs: y, style: S } = i;
  for (const E of D1)
    y[E] !== void 0 && (S[E] = y[E], delete y[E]);
  (S.transform || y.transformOrigin) && (S.transformOrigin = y.transformOrigin ?? "50% 50%", delete y.transformOrigin), S.transform && (S.transformBox = (v == null ? void 0 : v.transformBox) ?? "fill-box", delete y.transformBox), a !== void 0 && (y.x = a), s !== void 0 && (y.y = s), o !== void 0 && (y.scale = o), c !== void 0 && $2(y, c, d, f, !1);
}
function z1({ top: i, left: a, right: s, bottom: o }) {
  return {
    x: { min: a, max: s },
    y: { min: i, max: o }
  };
}
function tw({ x: i, y: a }) {
  return { top: a.min, right: i.max, bottom: a.max, left: i.min };
}
function ew(i, a) {
  if (!a)
    return i;
  const s = a({ x: i.left, y: i.top }), o = a({ x: i.right, y: i.bottom });
  return {
    top: s.y,
    left: s.x,
    bottom: o.y,
    right: o.x
  };
}
function yd(i) {
  return i === void 0 || i === 1;
}
function Id({ scale: i, scaleX: a, scaleY: s }) {
  return !yd(i) || !yd(a) || !yd(s);
}
const Dl = [
  "rotate",
  "rotateX",
  "rotateY",
  "rotateZ",
  "skewX",
  "skewY"
];
function ga(i) {
  return Id(i) || N1(i) || R1(i);
}
function R1(i) {
  return i.z || i.rotate || i.rotateX || i.rotateY || i.rotateZ || i.skewX || i.skewY;
}
function N1(i) {
  return dv(i.x) || dv(i.y);
}
function dv(i) {
  return i && i !== "0%";
}
function nu(i, a, s) {
  const o = i - s, c = a * o;
  return s + c;
}
function hv(i, a, s, o, c) {
  return c !== void 0 && (i = nu(i, c, o)), nu(i, s, o) + a;
}
function Wd(i, a = 0, s = 1, o, c) {
  i.min = hv(i.min, a, s, o, c), i.max = hv(i.max, a, s, o, c);
}
function _1(i, { x: a, y: s }) {
  Wd(i.x, a.translate, a.scale, a.originPoint), Wd(i.y, s.translate, s.scale, s.originPoint);
}
const mv = 0.999999999999, pv = 1.0000000000001;
function nw(i, a, s, o = !1) {
  var h, p, g, v;
  const c = s.length;
  if (!c)
    return;
  a.x = a.y = 1;
  let d, f;
  for (let y = 0; y < c; y++)
    d = s[y], f = d.projectionDelta, ((p = (h = d.options.visualElement) == null ? void 0 : h.props.style) == null ? void 0 : p.display) !== "contents" && (o === !0 && d.options.layoutScroll && d.scroll && d !== d.root && (En(i.x, -d.scroll.offset.x), En(i.y, -d.scroll.offset.y)), f && (a.x *= f.x.scale, a.y *= f.y.scale, _1(i, f)), o && (((g = o.path) == null ? void 0 : g[y]) || o) !== d && ga(d.latestValues) && jr(i, d.latestValues, (v = d.layout) == null ? void 0 : v.layoutBox));
  a.x < pv && a.x > mv && (a.x = 1), a.y < pv && a.y > mv && (a.y = 1);
}
function En(i, a) {
  i.min += a, i.max += a;
}
function gv(i, a, s, o, c = 0.5) {
  const d = Jt(i.min, i.max, c);
  Wd(i, a, s, d, o);
}
function yv(i, a) {
  return typeof i == "string" ? parseFloat(i) / 100 * (a.max - a.min) : i;
}
function jr(i, a, s) {
  const o = s ?? i;
  gv(i.x, yv(a.x, o.x), a.scaleX, a.scale, a.originX), gv(i.y, yv(a.y, o.y), a.scaleY, a.scale, a.originY);
}
function V1(i, a) {
  return z1(ew(i.getBoundingClientRect(), a));
}
function iw(i, a, s) {
  const o = V1(i, s), { scroll: c } = a;
  return c && (En(o.x, c.offset.x), En(o.y, c.offset.y)), o;
}
const aw = () => {
  var i, a;
  return {
    x: document.documentElement.scrollLeft || ((i = document.body) == null ? void 0 : i.scrollLeft) || 0,
    y: document.documentElement.scrollTop || ((a = document.body) == null ? void 0 : a.scrollTop) || 0
  };
}, { schedule: Xh } = /* @__PURE__ */ Jb(queueMicrotask, !1);
function lw(i, a, s) {
  const o = me(i) ? i : Aa(i);
  return o.run(Bh("", o, a, s)), o.animation;
}
const Bs = {};
function sw(i, a) {
  const s = Gt.now();
  i = pu(i);
  const o = ({ timestamp: c }) => {
    const d = c - s;
    d >= a && (Ye(o), i(d - a));
  };
  return qt.setup(o, !0), mu(() => Ye(o));
}
function ow(i) {
  return i && typeof i == "object" && Object.prototype.hasOwnProperty.call(i, "current");
}
function rw(i) {
  return Gh(i) && i.tagName === "svg";
}
function Gr(i) {
  return me(i) ? i.get() : i;
}
const vv = (i) => typeof i == "number" ? i : parseFloat(i), uw = jh.length, bv = (i) => typeof i == "number" || gt.test(i);
function cw(i, a, s, o, c, d) {
  c ? (i.opacity = Jt(0, s.opacity ?? 1, fw(o)), i.opacityExit = Jt(a.opacity ?? 1, 0, dw(o))) : d && (i.opacity = Jt(a.opacity ?? 1, s.opacity ?? 1, o));
  for (let f = 0; f < uw; f++) {
    const h = jh[f];
    let p = Sv(a, h), g = Sv(s, h);
    if (p === void 0 && g === void 0)
      continue;
    p || (p = 0), g || (g = 0), p === 0 || g === 0 || bv(p) === bv(g) ? (i[h] = Math.max(Jt(vv(p), vv(g), o), 0), (jn.test(g) || jn.test(p)) && (i[h] += "%")) : i[h] = g;
  }
  for (let f = 0; f < Dl.length; f++) {
    const h = Dl[f];
    (a[h] || s[h]) && (i[h] = Jt(a[h] || 0, s[h] || 0, o));
  }
}
function Sv(i, a) {
  return i[a] !== void 0 ? i[a] : i.borderRadius;
}
const fw = /* @__PURE__ */ L1(0, 0.5, Hb), dw = /* @__PURE__ */ L1(0.5, 0.95, xn);
function L1(i, a, s) {
  return (o) => o < i ? 0 : o > a ? 1 : s(/* @__PURE__ */ Ea(i, a, o));
}
const hw = (i, a, { x: s, y: o }) => {
  const c = i * i + a * a;
  return c < 1 ? 0 : -1e3 * (s * i + o * a) / c;
}, mw = (i, a = 300) => {
  const s = Gn(0.25, 2, a / 300), { stiffness: o, damping: c } = e1({
    ...i,
    duration: i.duration && /* @__PURE__ */ Oe(i.duration)
  });
  return { ...i, stiffness: o, damping: c * Math.sqrt(s), mass: s };
};
function $d(i, a) {
  i.min = a.min, i.max = a.max;
}
function bn(i, a) {
  $d(i.x, a.x), $d(i.y, a.y);
}
function Tv(i, a) {
  i.translate = a.translate, i.scale = a.scale, i.originPoint = a.originPoint, i.origin = a.origin;
}
const U1 = 1e-4, pw = 1 - U1, gw = 1 + U1, B1 = 0.01, yw = 0 - B1, vw = 0 + B1;
function De(i) {
  return i.max - i.min;
}
function bw(i, a, s) {
  return Math.abs(i - a) <= s;
}
function Ev(i, a, s, o = 0.5) {
  i.origin = o, i.originPoint = Jt(a.min, a.max, i.origin), i.scale = De(s) / De(a), i.translate = Jt(s.min, s.max, i.origin) - i.originPoint, (i.scale >= pw && i.scale <= gw || isNaN(i.scale)) && (i.scale = 1), (i.translate >= yw && i.translate <= vw || isNaN(i.translate)) && (i.translate = 0);
}
function iu(i, a, s, o) {
  Ev(i.x, a.x, s.x, o == null ? void 0 : o.originX), Ev(i.y, a.y, s.y, o == null ? void 0 : o.originY);
}
function Av(i, a, s, o = 0) {
  const c = o ? Jt(s.min, s.max, o) : s.min;
  i.min = c + a.min, i.max = i.min + De(a);
}
function Sw(i, a, s, o) {
  Av(i.x, a.x, s.x, o == null ? void 0 : o.x), Av(i.y, a.y, s.y, o == null ? void 0 : o.y);
}
function xv(i, a, s, o = 0) {
  const c = o ? Jt(s.min, s.max, o) : s.min;
  i.min = a.min - c, i.max = i.min + De(a);
}
function au(i, a, s, o) {
  xv(i.x, a.x, s.x, o == null ? void 0 : o.x), xv(i.y, a.y, s.y, o == null ? void 0 : o.y);
}
function Mv(i, a, s, o, c) {
  return i -= a, i = nu(i, 1 / s, o), c !== void 0 && (i = nu(i, 1 / c, o)), i;
}
function Tw(i, a = 0, s = 1, o = 0.5, c, d = i, f = i) {
  if (jn.test(a) && (a = parseFloat(a), a = Jt(f.min, f.max, a / 100) - f.min), typeof a != "number")
    return;
  let h = Jt(d.min, d.max, o);
  i === d && (h -= a), i.min = Mv(i.min, a, s, h, c), i.max = Mv(i.max, a, s, h, c);
}
function wv(i, a, [s, o, c], d, f) {
  Tw(i, a[s], a[o], a[c], a.scale, d, f);
}
const Ew = ["x", "scaleX", "originX"], Aw = ["y", "scaleY", "originY"];
function Cv(i, a, s, o) {
  wv(i.x, a, Ew, s == null ? void 0 : s.x, o == null ? void 0 : o.x), wv(i.y, a, Aw, s == null ? void 0 : s.y, o == null ? void 0 : o.y);
}
const Dv = (i) => typeof navigator < "u" && navigator.userAgent && navigator.userAgent.toLowerCase().includes(i), Ov = Dv("applewebkit/") && !Dv("chrome/") ? Math.round : xn;
function zv(i) {
  i.min = Ov(i.min), i.max = Ov(i.max);
}
function xw(i) {
  zv(i.x), zv(i.y);
}
const Rv = () => ({
  translate: 0,
  scale: 1,
  origin: 0,
  originPoint: 0
}), El = () => ({
  x: Rv(),
  y: Rv()
}), Nv = () => ({ min: 0, max: 0 }), de = () => ({
  x: Nv(),
  y: Nv()
});
function _v(i) {
  return i.translate === 0 && i.scale === 1;
}
function H1(i) {
  return _v(i.x) && _v(i.y);
}
function Vv(i, a) {
  return i.min === a.min && i.max === a.max;
}
function Mw(i, a) {
  return Vv(i.x, a.x) && Vv(i.y, a.y);
}
function Lv(i, a) {
  return Math.round(i.min) === Math.round(a.min) && Math.round(i.max) === Math.round(a.max);
}
function j1(i, a) {
  return Lv(i.x, a.x) && Lv(i.y, a.y);
}
function Uv(i) {
  return De(i.x) / De(i.y);
}
function Bv(i, a) {
  return i.translate === a.translate && i.scale === a.scale && i.originPoint === a.originPoint;
}
class ww {
  constructor() {
    this.members = [];
  }
  add(a) {
    ph(this.members, a);
    for (let s = this.members.length - 1; s >= 0; s--) {
      const o = this.members[s];
      if (o === a || o === this.lead || o === this.prevLead)
        continue;
      const c = o.instance;
      (!c || c.isConnected === !1) && !o.snapshot && (Pr(this.members, o), o.unmount());
    }
    a.scheduleRender();
  }
  remove(a) {
    if (Pr(this.members, a), a === this.prevLead && (this.prevLead = void 0), a === this.lead) {
      const s = this.members[this.members.length - 1];
      s && this.promote(s);
    }
  }
  relegate(a) {
    var s;
    for (let o = this.members.indexOf(a) - 1; o >= 0; o--) {
      const c = this.members[o];
      if (c.isPresent !== !1 && ((s = c.instance) == null ? void 0 : s.isConnected) !== !1)
        return this.promote(c), !0;
    }
    return !1;
  }
  promote(a, s) {
    var c;
    const o = this.lead;
    if (a !== o && (this.prevLead = o, this.lead = a, a.show(), o)) {
      o.updateSnapshot(), a.scheduleRender();
      const { layoutDependency: d } = o.options, { layoutDependency: f } = a.options;
      (d === void 0 || d !== f) && (a.resumeFrom = o, s && (o.preserveOpacity = !0), o.snapshot && (a.snapshot = o.snapshot, a.snapshot.latestValues = o.animationValues || o.latestValues), (c = a.root) != null && c.isUpdating && (a.isLayoutDirty = !0)), a.options.crossfade === !1 && o.hide();
    }
  }
  exitAnimationComplete() {
    this.members.forEach((a) => {
      var s, o, c, d, f;
      (o = (s = a.options).onExitComplete) == null || o.call(s), (f = (c = a.resumingFrom) == null ? void 0 : (d = c.options).onExitComplete) == null || f.call(d);
    });
  }
  scheduleRender() {
    this.members.forEach((a) => a.instance && a.scheduleRender(!1));
  }
  removeLeadSnapshot() {
    var a;
    (a = this.lead) != null && a.snapshot && (this.lead.snapshot = void 0);
  }
}
function Hv(i, a) {
  return a.max === a.min ? 0 : i / (a.max - a.min) * 100;
}
const _s = {
  correct: (i, a) => {
    if (!a.target)
      return i;
    if (typeof i == "string")
      if (gt.test(i))
        i = parseFloat(i);
      else
        return i;
    const s = Hv(i, a.target.x), o = Hv(i, a.target.y);
    return `${s}% ${o}%`;
  }
}, Cw = {
  correct: (i, { treeScale: a, projectionDelta: s }) => {
    const o = i, c = dn.parse(i);
    if (c.length > 5)
      return o;
    const d = dn.createTransformer(i), f = typeof c[0] != "number" ? 1 : 0, h = s.x.scale * a.x, p = s.y.scale * a.y;
    c[0 + f] /= h, c[1 + f] /= p;
    const g = Jt(h, p, 0.5);
    return typeof c[2 + f] == "number" && (c[2 + f] /= g), typeof c[3 + f] == "number" && (c[3 + f] /= g), d(c);
  }
}, Dw = {
  borderRadius: /* @__PURE__ */ Object.assign({}, _s, {
    applyTo: /* @__PURE__ */ jh.slice()
  }),
  borderTopLeftRadius: _s,
  borderTopRightRadius: _s,
  borderBottomLeftRadius: _s,
  borderBottomRightRadius: _s,
  boxShadow: Cw
};
function Ow(i, a, s) {
  let o = "";
  const c = i.x.translate / a.x, d = i.y.translate / a.y, f = (s == null ? void 0 : s.z) || 0;
  (c || d || f) && (o = `translate3d(${c}px, ${d}px, ${f}px) `);
  let h = "";
  if (s) {
    const { transformPerspective: p } = s;
    p && (o = `perspective(${p}px) ${o}`);
    for (let g = 0; g < Dl.length; g++) {
      const v = Dl[g], y = s[v];
      y && (h += `${v}(${y}deg) `), !g && s.pathRotation && (h += `rotate(${s.pathRotation}deg) `);
    }
  }
  if (h) {
    (a.x !== 1 || a.y !== 1) && (o += `scale(${1 / a.x}, ${1 / a.y}) `), o += h;
    const p = i.x.scale * a.x, g = i.y.scale * a.y;
    (p !== 1 || g !== 1) && (o += `scale(${p}, ${g})`);
  } else i.x.scale !== 1 || i.y.scale !== 1 ? o += `scale(${i.x.scale}, ${i.y.scale})` : !o && (a.x !== 1 || a.y !== 1) && (o = "scale(1, 1)");
  return o || "none";
}
function Tn(i) {
  return [i("x"), i("y")];
}
const zw = (i, a) => i.depth - a.depth;
class Rw {
  constructor() {
    this.children = [], this.isDirty = !1;
  }
  add(a) {
    ph(this.children, a), this.isDirty = !0;
  }
  remove(a) {
    Pr(this.children, a), this.isDirty = !0;
  }
  forEach(a) {
    this.isDirty && this.children.sort(zw), this.isDirty = !1, this.children.forEach(a);
  }
}
const Yr = {
  /**
   * Global flag as to whether the tree has animated since the last time
   * we resized the window
   */
  hasAnimatedSinceResize: !0,
  /**
   * We set this to true once, on the first update. Any nodes added to the tree beyond that
   * update will be given a `data-projection-id` attribute.
   */
  hasEverUpdated: !1
}, jv = ["z", "skew", "skewZ"], Nw = 1e3;
let _w = 0;
function Gv(i, a, s, o) {
  const { latestValues: c } = a;
  c[i] && (s[i] = c[i], a.setStaticValue(i, 0), o && (o[i] = 0));
}
const vd = (i) => {
  var a;
  return i.instance && ((a = Cl.get(i.instance)) == null ? void 0 : a.demote()) && i.resetSkewAndRotation();
};
function G1(i) {
  if (i.hasCheckedOptimisedAppear = !0, i.root === i)
    return;
  const { visualElement: a } = i.options;
  if (!a)
    return;
  const s = M1(a);
  if (window.MotionHasOptimisedAnimation(s, "transform")) {
    const { layout: c, layoutId: d } = i.options;
    window.MotionCancelOptimisedAnimation(s, "transform", qt, !(c || d));
  }
  const { parent: o } = i;
  o && !o.hasCheckedOptimisedAppear && G1(o);
}
function Y1(i) {
  if (i)
    return i.options.allowProjection !== !1 ? i.projection : Y1(i.parent);
}
function q1({ attachResizeListener: i, defaultParent: a, measureScroll: s, checkIsScrollRoot: o, resetTransform: c }) {
  return Object.assign(Bs, {
    ...Dw,
    ...Bs
  }), class {
    /**
     * Create the projection node of a `motion` component's VisualElement,
     * from its props. This runs while the component renders, before its
     * children. It's here rather than in the component so React
     * bundles only include it with the features that supply a
     * ProjectionNode. Vanilla bundles that use the projection node
     * (drag(), animateLayout()) include it too, as a class static
     * can't be tree-shaken.
     */
    static create(f, h, p) {
      var H;
      const { layoutId: g, layout: v, drag: y, dragConstraints: S, layoutScroll: E, layoutRoot: A, layoutAnchor: w, layoutCrossfade: M } = h, C = f.projection = new this(f.latestValues, h["data-framer-portal-id"] ? void 0 : Y1(f.parent));
      C.setOptions({
        layoutId: g,
        layout: v,
        alwaysMeasureLayout: !!y || S && ow(S),
        visualElement: f,
        /**
         * TODO: Update options in an effect. This could be tricky as it'll be too late
         * to update by the time layout animations run.
         * We also need to fix this safeToRemove by linking it up to the one returned by usePresence,
         * ensuring it gets called if there's no potential layout animations.
         *
         */
        animationType: typeof v == "string" ? v : "both",
        initialPromotionConfig: p,
        crossfade: M,
        layoutScroll: E,
        layoutRoot: A,
        layoutAnchor: w
      });
      const N = (H = C.getStack()) == null ? void 0 : H.lead;
      N && !C.root.isUpdateBlocked() && (N.willUpdate(), N.scheduleCheckAfterUnmount());
    }
    constructor(f = {}, h = a == null ? void 0 : a()) {
      this.id = _w++, this.animationId = 0, this.animationCommitId = 0, this.children = /* @__PURE__ */ new Set(), this.options = {}, this.isTreeAnimating = !1, this.isAnimationBlocked = !1, this.isLayoutDirty = !1, this.isProjectionDirty = !1, this.isSharedProjectionDirty = !1, this.isTransformDirty = !1, this.updateManuallyBlocked = !1, this.updateBlockedByResize = !1, this.isUpdating = !1, this.isSVG = !1, this.needsReset = !1, this.shouldResetTransform = !1, this.hasCheckedOptimisedAppear = !1, this.treeScale = { x: 1, y: 1 }, this.eventHandlers = /* @__PURE__ */ new Map(), this.hasTreeAnimated = !1, this.updateScheduled = !1, this.scheduleUpdate = () => this.update(), this.projectionUpdateScheduled = !1, this.checkUpdateFailed = () => {
        this.isUpdating && (this.isUpdating = !1, this.clearAllSnapshots());
      }, this.updateProjection = () => {
        this.projectionUpdateScheduled = !1, this.nodes.forEach(Uw), this.nodes.forEach(Qw), this.nodes.forEach(Zw), this.nodes.forEach(Bw);
      }, this.resolvedRelativeTargetAt = 0, this.hasProjected = !1, this.isVisible = !0, this.animationProgress = 0, this.sharedNodes = /* @__PURE__ */ new Map(), this.latestValues = f, this.root = h ? h.root || h : this, this.path = h ? [...h.path, h] : [], this.parent = h, this.depth = h ? h.depth + 1 : 0;
      for (let p = 0; p < this.path.length; p++)
        this.path[p].shouldResetTransform = !0;
      this.root === this && (this.nodes = new Rw());
    }
    addEventListener(f, h) {
      return this.eventHandlers.has(f) || this.eventHandlers.set(f, new Jr()), this.eventHandlers.get(f).add(h);
    }
    notifyListeners(f, ...h) {
      var p;
      (p = this.eventHandlers.get(f)) == null || p.notify(...h);
    }
    hasListeners(f) {
      return this.eventHandlers.has(f);
    }
    /**
     * Lifecycles
     */
    mount(f) {
      var v;
      if (this.instance)
        return;
      this.isSVG = Gh(f) && !rw(f), this.instance = f;
      const { layoutId: h, layout: p, visualElement: g } = this.options;
      if (g && !g.current && g.mount(f), this.root.nodes.add(this), (v = this.parent) == null || v.children.add(this), this.root.hasTreeAnimated && (p || h) && (this.isLayoutDirty = !0), i) {
        let y, S = 0;
        const E = () => this.root.updateBlockedByResize = !1;
        qt.read(() => {
          S = window.innerWidth;
        }), i(f, () => {
          const A = window.innerWidth;
          A !== S && (S = A, this.root.updateBlockedByResize = !0, y == null || y(), y = sw(E, 250), Yr.hasAnimatedSinceResize && (Yr.hasAnimatedSinceResize = !1, this.nodes.forEach(Xv)));
        });
      }
      h && this.root.registerSharedNode(h, this), this.addLayoutListener();
    }
    /**
     * Only register the layout animation handler if this node requires
     * layout animation. This is called on mount, and again whenever options
     * change, as `layout` or `layoutId` may be enabled after mount.
     */
    addLayoutListener() {
      const { layoutId: f, layout: h, visualElement: p, animate: g } = this.options;
      !this.instance || this.hasLayoutListener || g === !1 || !p || !(f || h) || (this.hasLayoutListener = !0, this.addEventListener("didUpdate", ({ delta: v, hasLayoutChanged: y, hasRelativeLayoutChanged: S, layout: E }) => {
        var H, X;
        if (this.isAnimationBlocked) {
          this.target = void 0, this.relativeTarget = void 0;
          return;
        }
        const A = this.options.transition || p.getDefaultTransition() || Iw, { onLayoutAnimationStart: w, onLayoutAnimationComplete: M } = p.getProps(), C = !this.targetLayout || !j1(this.targetLayout, E), N = !y && S;
        if (this.options.layoutRoot || this.resumeFrom || N || y && (C || !this.currentAnimation)) {
          this.resumeFrom && (this.resumingFrom = this.resumeFrom, this.resumingFrom.resumingFrom = void 0);
          const I = {
            ...Uh(A, "layout"),
            onPlay: w,
            onComplete: M
          };
          (p.shouldReduceMotion || this.options.layoutRoot) && (I.delay = 0, I.type = !1), this.startAnimation(I), this.setAnimationOrigin(v, N, I.path);
        } else
          y || Xv(this), this.isLead() && ((X = (H = this.options).onExitComplete) == null || X.call(H));
        this.targetLayout = E;
      }));
    }
    unmount() {
      var f, h;
      this.options.layoutId && this.willUpdate(), this.root.nodes.remove(this), (f = this.getStack()) == null || f.remove(this), (h = this.parent) == null || h.children.delete(this), this.instance = void 0, this.eventHandlers.clear(), this.hasLayoutListener = !1, Ye(this.updateProjection);
    }
    // only on the root
    blockUpdate() {
      this.updateManuallyBlocked = !0;
    }
    unblockUpdate() {
      this.updateManuallyBlocked = !1;
    }
    isUpdateBlocked() {
      return this.updateManuallyBlocked || this.updateBlockedByResize;
    }
    // Note: currently only running on root node
    startUpdate() {
      var f;
      this.isUpdateBlocked() || (this.isUpdating = !0, (f = this.nodes) == null || f.forEach(Kw), this.animationId++);
    }
    getTransformTemplate() {
      const { visualElement: f } = this.options;
      return f && f.getProps().transformTemplate;
    }
    willUpdate(f = !0) {
      var v, y;
      if (this.root.hasTreeAnimated = !0, this.root.isUpdateBlocked()) {
        (y = (v = this.options).onExitComplete) == null || y.call(v);
        return;
      }
      if (window.MotionCancelOptimisedAnimation && !this.hasCheckedOptimisedAppear && G1(this), !this.root.isUpdating && this.root.startUpdate(), this.isLayoutDirty)
        return;
      vd(this), this.isLayoutDirty = !0;
      for (let S = 0; S < this.path.length; S++) {
        const E = this.path[S];
        E.shouldResetTransform = !0, vd(E), (typeof E.latestValues.x == "string" || typeof E.latestValues.y == "string") && (E.isLayoutDirty = !0), E.updateScroll("snapshot"), E.options.layoutRoot && E.willUpdate(!1), E.isAnimationBlocked && (E.dragSnapshot || (E.dragSnapshot = E.measure()), this.dragAncestor = E);
      }
      const { layoutId: h, layout: p } = this.options;
      if (h === void 0 && !p)
        return;
      const g = this.getTransformTemplate();
      this.prevTransformTemplateValue = g ? g(this.latestValues, "") : void 0, this.updateSnapshot(), f && this.notifyListeners("willUpdate");
    }
    update() {
      if (this.updateScheduled = !1, this.isUpdateBlocked()) {
        const p = this.updateBlockedByResize;
        this.unblockUpdate(), this.updateBlockedByResize = !1, this.clearAllSnapshots(), p && this.nodes.forEach(jw), this.nodes.forEach(Yv);
        return;
      }
      if (this.animationId <= this.animationCommitId) {
        this.nodes.forEach(qv);
        return;
      }
      this.animationCommitId = this.animationId, this.isUpdating ? (this.isUpdating = !1, this.nodes.forEach(Yw), this.nodes.forEach(qw), this.nodes.forEach(Xw), this.nodes.forEach(Vw), this.nodes.forEach(Lw)) : this.nodes.forEach(qv), this.clearAllSnapshots();
      const h = Gt.now();
      le.delta = Gn(0, 1e3 / 60, h - le.timestamp), le.timestamp = h, le.isProcessing = !0, fd.update.process(le), fd.preRender.process(le), fd.render.process(le), le.isProcessing = !1;
    }
    didUpdate() {
      this.updateScheduled || (this.updateScheduled = !0, Xh.read(this.scheduleUpdate));
    }
    clearAllSnapshots() {
      this.nodes.forEach(Hw), this.sharedNodes.forEach((f, h) => f.members.length ? f.removeLeadSnapshot() : this.sharedNodes.delete(h));
    }
    scheduleUpdateProjection() {
      this.projectionUpdateScheduled || (this.projectionUpdateScheduled = !0, qt.preRender(this.updateProjection, !1, !0));
    }
    scheduleCheckAfterUnmount() {
      qt.postRender(() => {
        this.isLayoutDirty ? this.root.didUpdate() : this.root.checkUpdateFailed();
      });
    }
    /**
     * Update measurements
     */
    updateSnapshot() {
      var f, h, p;
      if (!(this.snapshot || !this.instance) && (this.snapshot = this.measure(), this.snapshot && !De(this.snapshot.measuredBox.x) && !De(this.snapshot.measuredBox.y) && (this.snapshot = void 0), this.snapshot)) {
        const { visualElement: g } = this.options, v = ((f = this.currentAnimation) == null ? void 0 : f.state) === "running", y = v && this.animationEdges;
        v && this.relativeTarget && (this.snapshot.relativeVelocity = ((h = this.relativeVelocity) == null ? void 0 : h.slice()) || []);
        const S = y && ((p = this.motionValue) == null ? void 0 : p.getVelocity()) || 0, E = [0, 1, 2, 3, 4, 5].map((A) => {
          var w;
          return (A < 4 ? y && (this.edgeValues ? this.edgeVelocity(A) : -y[A] * S / 1e3) : (w = g == null ? void 0 : g.getValue(A < 5 ? "x" : "y")) == null ? void 0 : w.getVelocity()) || 0;
        });
        E.some(Boolean) && (this.snapshot.velocity = E);
      }
    }
    updateLayout() {
      if (!this.instance || (this.updateScroll(), !(this.options.alwaysMeasureLayout && this.isLead()) && !this.isLayoutDirty))
        return;
      if (this.resumeFrom && !this.resumeFrom.instance)
        for (let p = 0; p < this.path.length; p++)
          this.path[p].updateScroll();
      const f = this.layout;
      this.layout = this.measure(!1), this.layoutCorrected || (this.layoutCorrected = de()), this.isLayoutDirty = !1, this.projectionDelta = void 0, this.notifyListeners("measure", this.layout.layoutBox);
      const { visualElement: h } = this.options;
      h == null || h.notify("LayoutMeasure", this.layout.layoutBox, f == null ? void 0 : f.layoutBox);
    }
    updateScroll(f = "measure") {
      const { scroll: h, instance: p } = this, { animationId: g } = this.root;
      if (this.options.layoutScroll && p && !(h && h.animationId === g && h.phase === f)) {
        const v = o(p);
        this.scroll = {
          animationId: g,
          phase: f,
          isRoot: v,
          offset: s(p),
          wasRoot: h ? h.isRoot : v
        };
      }
    }
    resetTransform() {
      if (!c)
        return;
      const f = this.isLayoutDirty || this.shouldResetTransform || this.options.alwaysMeasureLayout;
      f && vd(this);
      const h = this.projectionDelta && !H1(this.projectionDelta), p = this.getTransformTemplate(), g = p ? p(this.latestValues, "") : void 0, v = g !== this.prevTransformTemplateValue;
      f && this.instance && (h || ga(this.latestValues) || v) && (c(this.instance, g), this.shouldResetTransform = !1, this.scheduleRender());
    }
    measure(f = !0) {
      const h = this.measurePageBox();
      let p = this.removeElementScroll(h);
      return f && (p = this.removeTransform(p)), xw(p), {
        animationId: this.root.animationId,
        measuredBox: h,
        layoutBox: p,
        latestValues: {},
        source: this.id
      };
    }
    measurePageBox() {
      var g;
      const { visualElement: f } = this.options;
      if (!f)
        return de();
      const h = f.measureViewportBox();
      if (!(((g = this.scroll) == null ? void 0 : g.wasRoot) || this.path.some(Ww))) {
        const { scroll: v } = this.root;
        v && (En(h.x, v.offset.x), En(h.y, v.offset.y));
      }
      return h;
    }
    removeElementScroll(f) {
      var p;
      const h = de();
      if (bn(h, f), (p = this.scroll) != null && p.wasRoot)
        return h;
      for (let g = 0; g < this.path.length; g++) {
        const v = this.path[g], { scroll: y, options: S } = v;
        v !== this.root && y && S.layoutScroll && (y.wasRoot && bn(h, f), En(h.x, y.offset.x), En(h.y, y.offset.y));
      }
      return h;
    }
    applyTransform(f, h = !1, p, g, v = 0) {
      var S, E;
      const y = p || de();
      bn(y, f);
      for (let A = v; A < this.path.length; A++) {
        const w = this.path[A];
        !h && w.options.layoutScroll && w.scroll && w !== w.root && (En(y.x, -w.scroll.offset.x), En(y.y, -w.scroll.offset.y)), ga(w.latestValues) && jr(y, w.latestValues, (S = w.layout) == null ? void 0 : S.layoutBox);
      }
      return !g && ga(this.latestValues) && jr(y, this.latestValues, (E = this.layout) == null ? void 0 : E.layoutBox), y;
    }
    removeTransform(f) {
      var p;
      const h = de();
      bn(h, f);
      for (let g = 0; g < this.path.length; g++) {
        const v = this.path[g];
        if (!ga(v.latestValues))
          continue;
        let y;
        v.instance && (Id(v.latestValues) && v.updateSnapshot(), y = de(), bn(y, v.measurePageBox())), Cv(h, v.latestValues, (p = v.snapshot) == null ? void 0 : p.layoutBox, y);
      }
      return ga(this.latestValues) && Cv(h, this.latestValues), h;
    }
    setTargetDelta(f) {
      this.targetDelta = f, this.root.scheduleUpdateProjection(), this.isProjectionDirty = !0;
    }
    setOptions(f) {
      this.options = {
        ...this.options,
        ...f,
        crossfade: f.crossfade !== void 0 ? f.crossfade : !0
      }, this.addLayoutListener();
    }
    clearMeasurements() {
      this.scroll = void 0, this.layout = void 0, this.snapshot = void 0, this.prevTransformTemplateValue = void 0, this.targetDelta = void 0, this.target = void 0, this.isLayoutDirty = !1;
    }
    forceRelativeParentToResolveTarget() {
      this.relativeParent && this.relativeParent.resolvedRelativeTargetAt !== le.timestamp && this.relativeParent.resolveTargetDelta(!0);
    }
    resolveTargetDelta(f = !1) {
      var E;
      const h = this.getLead();
      this.isProjectionDirty || (this.isProjectionDirty = h.isProjectionDirty), this.isTransformDirty || (this.isTransformDirty = h.isTransformDirty), this.isSharedProjectionDirty || (this.isSharedProjectionDirty = h.isSharedProjectionDirty);
      const p = !!this.resumingFrom || this !== h;
      if (!(f || p && this.isSharedProjectionDirty || this.isProjectionDirty || (E = this.parent) != null && E.isProjectionDirty || this.attemptToResolveRelativeTarget || this.root.updateBlockedByResize))
        return;
      const { layout: v, layoutId: y } = this.options;
      if (!this.layout || !(v || y))
        return;
      this.resolvedRelativeTargetAt = le.timestamp;
      const S = this.getClosestProjectingParent();
      !this.targetDelta && !this.relativeTarget && (this.options.layoutAnchor !== !1 && S && S.layout ? this.createRelativeTarget(S, this.layout.layoutBox, S.layout.layoutBox) : this.removeRelativeTarget()), !(!this.relativeTarget && !this.targetDelta) && (this.target || (this.target = de(), this.targetWithTransforms = de()), this.relativeTarget && this.relativeTargetOrigin && this.relativeParent && this.relativeParent.target ? (this.forceRelativeParentToResolveTarget(), Sw(this.target, this.relativeTarget, this.relativeParent.target, this.options.layoutAnchor || void 0)) : this.targetDelta ? (this.resumingFrom ? this.applyTransform(this.layout.layoutBox, !1, this.target, !0) : bn(this.target, this.layout.layoutBox), _1(this.target, this.targetDelta)) : bn(this.target, this.layout.layoutBox), this.attemptToResolveRelativeTarget && (this.attemptToResolveRelativeTarget = !1, this.options.layoutAnchor !== !1 && S && (!S.resumingFrom == !this.resumingFrom || /**
       * Shared layout animations within a layoutRoot
       * animate relative to it.
       */
      S.options.layoutRoot && !S.resumingFrom) && !S.options.layoutScroll && S.target && this.animationProgress !== 1 ? this.createRelativeTarget(S, this.target, S.target) : this.relativeParent = this.relativeTarget = void 0));
    }
    getClosestProjectingParent() {
      if (!(!this.parent || Id(this.parent.latestValues) || N1(this.parent.latestValues)))
        return this.parent.isProjecting() ? this.parent : this.parent.getClosestProjectingParent();
    }
    isProjecting() {
      return !!((this.relativeTarget || this.targetDelta || this.options.layoutRoot) && this.layout);
    }
    createRelativeTarget(f, h, p) {
      this.relativeParent = f, this.forceRelativeParentToResolveTarget(), this.relativeTarget = de(), this.relativeTargetOrigin = de(), au(this.relativeTargetOrigin, h, p, this.options.layoutAnchor || void 0), bn(this.relativeTarget, this.relativeTargetOrigin);
    }
    removeRelativeTarget() {
      this.relativeParent = this.relativeTarget = void 0;
    }
    calcProjection() {
      var A, w;
      const f = this.getLead(), h = !!this.resumingFrom || this !== f;
      let p = !0;
      if ((this.isProjectionDirty || (A = this.parent) != null && A.isProjectionDirty) && (p = !1), h && (this.isSharedProjectionDirty || this.isTransformDirty) && (p = !1), this.resolvedRelativeTargetAt === le.timestamp && (p = !1), p)
        return;
      const { layout: g, layoutId: v } = this.options;
      if (this.isTreeAnimating = !!((w = this.parent) != null && w.isTreeAnimating || this.currentAnimation || this.pendingAnimation), this.isTreeAnimating || (this.targetDelta = this.relativeTarget = void 0), !this.layout || !(g || v))
        return;
      bn(this.layoutCorrected, this.layout.layoutBox);
      const y = this.treeScale.x, S = this.treeScale.y;
      nw(this.layoutCorrected, this.treeScale, this.path, h && (f.relativeTarget && !f.relativeParent.resumingFrom ? f.relativeParent : !0)), f.layout && !f.target && (this.treeScale.x !== 1 || this.treeScale.y !== 1) && (f.target = f.layout.layoutBox, f.targetWithTransforms = de());
      const { target: E } = f;
      if (!E) {
        this.prevProjectionDelta && (this.createProjectionDeltas(), this.scheduleRender());
        return;
      }
      !this.projectionDelta || !this.prevProjectionDelta ? this.createProjectionDeltas() : (Tv(this.prevProjectionDelta.x, this.projectionDelta.x), Tv(this.prevProjectionDelta.y, this.projectionDelta.y)), iu(this.projectionDelta, this.layoutCorrected, E, this.latestValues), (this.treeScale.x !== y || this.treeScale.y !== S || !Bv(this.projectionDelta.x, this.prevProjectionDelta.x) || !Bv(this.projectionDelta.y, this.prevProjectionDelta.y)) && (this.hasProjected = !0, this.scheduleRender(), this.notifyListeners("projectionUpdate", E));
    }
    hide() {
      this.isVisible = !1;
    }
    show() {
      this.isVisible = !0;
    }
    scheduleRender(f = !0) {
      var h, p;
      (h = this.options.visualElement) == null || h.scheduleRender(), f && ((p = this.getStack()) == null || p.scheduleRender()), this.resumingFrom && !this.resumingFrom.instance && (this.resumingFrom = void 0);
    }
    createProjectionDeltas() {
      this.prevProjectionDelta = El(), this.projectionDelta = El(), this.projectionDeltaWithTransform = El();
    }
    setAnimationOrigin(f, h = !1, p) {
      var D, at;
      const g = this.snapshot, v = g ? g.latestValues : {}, y = { ...this.latestValues }, S = El();
      (!this.relativeParent || !this.relativeParent.options.layoutRoot) && (this.relativeTarget = this.relativeTargetOrigin = void 0), this.attemptToResolveRelativeTarget = !h;
      const E = de(), A = (g == null ? void 0 : g.source) !== ((D = this.layout) == null ? void 0 : D.source), w = this.getStack(), M = !w || w.members.length <= 1, C = !!(A && !M && this.options.crossfade === !0 && !this.path.some(Fw));
      this.animationProgress = 0;
      let N;
      const H = p == null ? void 0 : p.interpolateProjection(f), X = (at = this.layout) == null ? void 0 : at.layoutBox;
      let I = X && [X.x.min, X.x.max, X.y.min, X.y.max].map((lt, st) => {
        const { translate: dt, scale: vt, originPoint: xt } = f[st < 2 ? "x" : "y"];
        return (lt - xt) * (vt - 1) + dt;
      });
      I != null && I.every(isFinite) || (I = void 0), this.animationEdges = I, this.edgeValues = this.startVelocity = this.impulse = this.relativeVelocity = this.relativeStart = void 0;
      const et = g == null ? void 0 : g.velocity, z = (g == null ? void 0 : g.relativeVelocity) || et;
      if (z != null && z.slice(0, 4).some(Boolean) && this.getClosestProjectingParent() && (this.relativeStart = z), et && I) {
        const lt = et.slice(0, 4).map((st, dt) => st + (A ? et[4 + (dt >> 1)] : 0));
        lt.some(Boolean) && (this.startVelocity = H ? hw(f.x.translate, f.y.translate, { x: (lt[0] + lt[1]) / 2, y: (lt[2] + lt[3]) / 2 }) : lt);
      }
      this.mixTargetDelta = (lt) => {
        const st = lt / 1e3, dt = H == null ? void 0 : H(st), vt = this.edgeValues;
        for (let xt = 0; xt < 2; xt++) {
          const St = xt ? "y" : "x";
          vt ? kw(S[St], f[St], this.layout.layoutBox[St], vt[xt * 2], vt[xt * 2 + 1]) : Pw(S[St], f[St], st);
        }
        if (dt && (S.x.translate = dt.x, S.y.translate = dt.y), this.setTargetDelta(S), this.relativeTarget && this.relativeTargetOrigin && this.layout && this.relativeParent && this.relativeParent.layout) {
          au(E, this.layout.layoutBox, this.relativeParent.layout.layoutBox, this.options.layoutAnchor || void 0);
          const xt = this.relativeTargetOrigin, St = E;
          if (Jw(this.relativeTarget, xt, St, st), this.isSpringLayout) {
            const F = this.relativeTarget, rt = this.impulse || 0, ut = this.relativeStart, nt = Gt.now(), L = (nt - this.relativeTime) / 1e3;
            this.relativeTime = nt;
            const K = this.relativeVelocity || (this.relativeVelocity = [0, 0, 0, 0]);
            for (let $ = 0; $ < 4; $++) {
              const tt = $ < 2 ? "x" : "y", T = $ & 1 ? "max" : "min";
              ut && (F[tt][T] += ut[$] * rt), N && L > 0 && (K[$] = (F[tt][T] - N[tt][T]) / L);
            }
          }
          N && Mw(this.relativeTarget, N) && (this.isProjectionDirty = !1), N || (N = de()), bn(N, this.relativeTarget);
        }
        A && (this.animationValues = y, cw(y, v, this.latestValues, st, C, M)), (dt == null ? void 0 : dt.rotate) !== void 0 && (this.animationValues || (this.animationValues = y), this.animationValues.pathRotation = dt.rotate), this.root.scheduleUpdateProjection(), this.scheduleRender(), this.animationProgress = st;
      }, this.mixTargetDelta(this.options.layoutRoot ? 1e3 : 0);
    }
    startAnimation(f) {
      var p, g, v;
      this.notifyListeners("animationStart");
      const h = this.isSpringLayout = f.type === "spring";
      (p = this.currentAnimation) == null || p.stop(), (v = (g = this.resumingFrom) == null ? void 0 : g.currentAnimation) == null || v.stop(), this.resumingFrom && (this.resumingFrom.edgeValues = void 0), this.pendingAnimation && (Ye(this.pendingAnimation), this.pendingAnimation = void 0), this.pendingAnimation = qt.update(() => {
        var w;
        Yr.hasAnimatedSinceResize = !0, this.motionValue || (this.motionValue = Aa(0)), this.motionValue.jump(0, !1);
        const y = this.startVelocity;
        this.startVelocity = void 0;
        let S = f, E = 0;
        if (h) {
          if (f.mass === "auto") {
            const C = (w = this.layout) == null ? void 0 : w.layoutBox;
            S = mw(f, C && Math.sqrt(De(C.x) * De(C.y)));
          }
          const M = this.relativeStart;
          if ((y || M) && !f.repeat)
            if (typeof y == "number")
              E = y;
            else {
              const C = y && this.animationEdges;
              S = {
                ...S,
                type: (N) => {
                  const H = [
                    N.velocity,
                    ...y || []
                  ].map((D, at) => Ir({
                    ...N,
                    keyframes: at ? [C[at - 1], 0] : N.keyframes,
                    velocity: D
                  })), X = H.length;
                  M && H.push(Ir({
                    ...N,
                    keyframes: [0, 0],
                    velocity: 1e3,
                    restDelta: 0.5,
                    restSpeed: 5
                  }));
                  let I = 0;
                  const et = [], z = {
                    calculatedDuration: null,
                    next: (D) => {
                      I = D;
                      const at = H[0].next(D);
                      let lt = at.done;
                      for (let st = 1; st < H.length; st++) {
                        const { value: dt, done: vt } = H[st].next(D);
                        st < X ? et[st - 1] = dt : this.impulse = dt / 1e3, lt = lt && vt;
                      }
                      return C && (this.edgeValues = et), at.done = lt, at;
                    }
                  };
                  return z.calculatedDuration = hu(z), z.next(0), this.edgeVelocity = (D) => H[D + 1].velocity(I), z;
                }
              };
            }
        }
        const A = lw(this.motionValue, [0, 1e3], {
          ...S,
          velocity: E,
          isSync: !0,
          onUpdate: (M) => {
            this.mixTargetDelta(M), f.onUpdate && f.onUpdate(M);
          },
          onComplete: () => {
            f.onComplete && f.onComplete(), this.completeAnimation();
          }
        });
        this.currentAnimation = A, zM(this.currentAnimation, this), this.resumingFrom && (this.resumingFrom.currentAnimation = this.currentAnimation), this.pendingAnimation = void 0;
      });
    }
    completeAnimation() {
      this.resumingFrom && (this.resumingFrom.currentAnimation = void 0, this.resumingFrom.preserveOpacity = void 0);
      const f = this.getStack();
      f && f.exitAnimationComplete(), this.resumingFrom = this.currentAnimation = this.animationValues = this.edgeValues = this.edgeVelocity = this.impulse = void 0, this.notifyListeners("animationComplete");
    }
    finishAnimation() {
      var f;
      this.currentAnimation && (this.edgeValues = this.impulse = void 0, (f = this.mixTargetDelta) == null || f.call(this, Nw), this.currentAnimation.stop()), this.completeAnimation();
    }
    applyTransformsToTarget() {
      const f = this.getLead(), { targetWithTransforms: h, layout: p, latestValues: g } = f;
      let { target: v } = f;
      if (!(!h || !v || !p)) {
        if (this !== f && this.layout && p && X1(this.options.animationType, this.layout.layoutBox, p.layoutBox)) {
          const { layoutBox: y } = this.layout, S = v;
          v = this.target || de(), Zv(v.x, S.x, y.x), Zv(v.y, S.y, y.y);
        }
        bn(h, v), jr(h, g), iu(this.projectionDeltaWithTransform, this.layoutCorrected, h, g);
      }
    }
    registerSharedNode(f, h) {
      this.sharedNodes.has(f) || this.sharedNodes.set(f, new ww()), this.sharedNodes.get(f).add(h);
      const g = h.options.initialPromotionConfig;
      h.promote({
        transition: g == null ? void 0 : g.transition,
        preserveFollowOpacity: g != null && g.shouldPreserveFollowOpacity ? g.shouldPreserveFollowOpacity(h) : void 0
      });
    }
    isLead() {
      const f = this.getStack();
      return f ? f.lead === this : !0;
    }
    getLead() {
      var h;
      const { layoutId: f } = this.options;
      return f ? ((h = this.getStack()) == null ? void 0 : h.lead) || this : this;
    }
    getPrevLead() {
      var h;
      const { layoutId: f } = this.options;
      return f ? (h = this.getStack()) == null ? void 0 : h.prevLead : void 0;
    }
    getStack() {
      const { layoutId: f } = this.options;
      if (f)
        return this.root.sharedNodes.get(f);
    }
    promote({ needsReset: f, transition: h, preserveFollowOpacity: p } = {}) {
      var g;
      (g = this.getStack()) == null || g.promote(this, p), f && (this.projectionDelta = void 0, this.needsReset = !0), h && this.setOptions({ transition: h });
    }
    relegate() {
      var f;
      return ((f = this.getStack()) == null ? void 0 : f.relegate(this)) || !1;
    }
    resetSkewAndRotation() {
      const { visualElement: f } = this.options;
      if (!f)
        return;
      const { latestValues: h } = f;
      if (!R1(h))
        return;
      const p = {};
      for (let g = 0; g < jv.length; g++)
        Gv(jv[g], f, p, this.animationValues);
      for (let g = 0; g < Dl.length; g++)
        Gv(Dl[g], f, p, this.animationValues);
      f.render();
      for (const g in p)
        f.setStaticValue(g, p[g]), this.animationValues && (this.animationValues[g] = p[g]);
      f.scheduleRender();
    }
    applyProjectionStyles(f, h) {
      if (!this.instance || this.isSVG)
        return;
      const p = this.getLead();
      if (!this.isVisible && p !== this) {
        f.visibility = "hidden";
        return;
      }
      const g = this.getTransformTemplate();
      if (this.needsReset) {
        this.needsReset = !1, f.visibility = "", f.opacity = "", f.pointerEvents = Gr(h == null ? void 0 : h.pointerEvents) || "", f.transform = g ? g(this.latestValues, "") : "none";
        return;
      }
      if (!this.projectionDelta || !this.layout || !p.target) {
        (this.options.layoutId || this.needsShow) && (this.needsShow = !1, f.visibility = "", f.opacity = this.latestValues.opacity !== void 0 ? this.latestValues.opacity : 1, f.pointerEvents = Gr(h == null ? void 0 : h.pointerEvents) || ""), this.hasProjected && !ga(this.latestValues) && (f.transform = g ? g({}, "") : "none", this.hasProjected = !1);
        return;
      }
      f.visibility = "";
      const v = p.animationValues || p.latestValues;
      this.applyTransformsToTarget();
      let y = Ow(this.projectionDeltaWithTransform, this.treeScale, v);
      g && (y = g(v, y)), f.transform = y;
      const { x: S, y: E } = this.projectionDelta;
      f.transformOrigin = `${S.origin * 100}% ${E.origin * 100}% 0`, p.animationValues ? f.opacity = p === this ? v.opacity ?? this.latestValues.opacity ?? 1 : this.preserveOpacity ? this.latestValues.opacity : v.opacityExit : f.opacity = p === this ? v.opacity !== void 0 ? v.opacity : "" : v.opacityExit !== void 0 ? v.opacityExit : 0;
      for (const A in Bs) {
        if (v[A] === void 0)
          continue;
        const { correct: w, applyTo: M, isCSSVariable: C } = Bs[A], N = y === "none" ? v[A] : w(v[A], p);
        if (M) {
          const H = M.length;
          for (let X = 0; X < H; X++)
            f[M[X]] = N;
        } else
          C ? this.options.visualElement.renderState.vars[A] = N : f[A] = N;
      }
      this.options.layoutId && (f.pointerEvents = p === this ? Gr(h == null ? void 0 : h.pointerEvents) || "" : "none");
    }
    clearSnapshot() {
      this.resumeFrom = this.snapshot = this.dragSnapshot = this.dragAncestor = void 0;
    }
    // Only run on root
    resetTree() {
      this.root.nodes.forEach((f) => {
        var h;
        return (h = f.currentAnimation) == null ? void 0 : h.stop();
      }), this.root.nodes.forEach(Yv), this.root.sharedNodes.clear();
    }
  };
}
function Vw(i) {
  i.updateLayout(), Gw(i);
}
function Lw(i) {
  var s, o, c, d;
  const a = ((s = i.resumeFrom) == null ? void 0 : s.snapshot) || i.snapshot;
  if (i.isLead() && i.layout && a && i.hasListeners("didUpdate")) {
    const { layoutBox: f, measuredBox: h } = i.layout, { animationType: p } = i.options, g = a.source !== i.layout.source, v = (C, N) => {
      if (p === "size")
        Tn((H) => {
          const X = De(C[H]);
          C[H].min = N[H].min, C[H].max = C[H].min + X;
        });
      else if (p === "x" || p === "y") {
        const H = p === "x" ? "y" : "x";
        $d(C[H], N[H]);
      } else X1(p, a.layoutBox, f) && Tn((H) => {
        const X = De(N[H]);
        C[H].max = C[H].min + X, i.relativeTarget && !i.currentAnimation && (i.isProjectionDirty = !0, i.relativeTarget[H].max = i.relativeTarget[H].min + X);
      });
    }, y = g ? a.measuredBox : a.layoutBox;
    v(y, f);
    const S = El();
    iu(S, f, a.layoutBox);
    const E = El();
    iu(E, g ? i.applyTransform(h, !0) : f, y);
    const A = !H1(S);
    let w = !1;
    const M = i.getClosestProjectingParent();
    if ((!g || M != null && M.options.layoutRoot && ((o = i.resumeFrom) != null && o.path.includes(M))) && M && !M.resumeFrom) {
      const { snapshot: C, layout: N } = M;
      if (C && N) {
        const H = i.options.layoutAnchor || void 0, X = de();
        au(X, g ? i.resumeFrom.applyTransform(a.layoutBox, !0, void 0, !0, M.depth + 1) : a.layoutBox, C.layoutBox, H);
        const I = de();
        au(I, f, N.layoutBox, H), g && v(X, I), j1(X, I) || (w = !0), M.options.layoutRoot && (i.relativeTarget = I, i.relativeTargetOrigin = X, i.relativeParent = M);
      }
    }
    i.notifyListeners("didUpdate", {
      layout: f,
      snapshot: a,
      delta: E,
      layoutDelta: S,
      hasLayoutChanged: A,
      hasRelativeLayoutChanged: w
    });
  } else i.isLead() && ((d = (c = i.options).onExitComplete) == null || d.call(c));
  i.options.transition = void 0;
}
function Uw(i) {
  i.parent && (i.isProjecting() || (i.isProjectionDirty = i.parent.isProjectionDirty), i.isSharedProjectionDirty || (i.isSharedProjectionDirty = !!(i.isProjectionDirty || i.parent.isProjectionDirty || i.parent.isSharedProjectionDirty)), i.isTransformDirty || (i.isTransformDirty = i.parent.isTransformDirty));
}
function Bw(i) {
  i.isProjectionDirty = i.isSharedProjectionDirty = i.isTransformDirty = !1;
}
function Hw(i) {
  i.clearSnapshot();
}
function Yv(i) {
  i.clearMeasurements();
}
function jw(i) {
  i.isLayoutDirty = !0, i.updateLayout();
}
function qv(i) {
  i.isLayoutDirty = !1;
}
function Gw(i) {
  const { snapshot: a, dragAncestor: s } = i, o = (s == null ? void 0 : s.isAnimationBlocked) && s.layout;
  if (!a || !o || i.resumeFrom || i.isAnimationBlocked)
    return;
  const c = s.dragSnapshot;
  Tn((d) => En(a.layoutBox[d], o.layoutBox[d].min - c.layoutBox[d].min));
}
function Yw(i) {
  i.isAnimationBlocked && i.layout && !i.isLayoutDirty && (i.snapshot = i.dragSnapshot || i.layout, i.isLayoutDirty = !0);
}
function qw(i) {
  var a;
  i.relativeTarget && ((a = i.relativeParent) != null && a.isLayoutDirty) && (i.currentAnimation ? i.isLayoutDirty = !0 : (i.targetDelta = void 0, i.removeRelativeTarget()));
}
function Xw(i) {
  const { visualElement: a } = i.options;
  a != null && a.getProps().onBeforeLayoutMeasure && a.notify("BeforeLayoutMeasure"), i.resetTransform();
}
function Xv(i) {
  i.finishAnimation(), i.targetDelta = i.relativeTarget = i.target = void 0, i.isProjectionDirty = !0;
}
function Qw(i) {
  i.resolveTargetDelta();
}
function Zw(i) {
  i.calcProjection();
}
function Kw(i) {
  i.resetSkewAndRotation();
}
function kw(i, a, s, o, c) {
  const d = s.max - s.min, f = d ? Math.max(0, (d + c - o) / d) : 1, h = i.originPoint = a.originPoint;
  i.origin = a.origin, i.scale = f, i.translate = s.min + o - (h + (s.min - h) * f);
}
function Pw(i, a, s) {
  i.translate = Jt(a.translate, 0, s), i.scale = Jt(a.scale, 1, s), i.origin = a.origin, i.originPoint = a.originPoint;
}
function Qv(i, a, s, o) {
  i.min = Jt(a.min, s.min, o), i.max = Jt(a.max, s.max, o);
}
function Jw(i, a, s, o) {
  Qv(i.x, a.x, s.x, o), Qv(i.y, a.y, s.y, o);
}
function Fw(i) {
  var a;
  return ((a = i.animationValues) == null ? void 0 : a.opacityExit) !== void 0;
}
const Iw = {
  duration: 0.45,
  ease: [0.4, 0, 0.1, 1]
};
function Zv(i, a, s) {
  i.max = De(s) + (i.min = a.min);
}
function X1(i, a, s) {
  return i === "position" || i === "preserve-aspect" && !bw(Uv(a), Uv(s), 0.2);
}
function Ww(i) {
  var a;
  return i !== i.root && ((a = i.scroll) == null ? void 0 : a.wasRoot);
}
function xa(i, a, s, o = { passive: !0 }) {
  return i.addEventListener(a, s, o), () => i.removeEventListener(a, s, o);
}
const $w = /* @__PURE__ */ q1({
  attachResizeListener: (i, a) => xa(i, "resize", a),
  measureScroll: aw,
  checkIsScrollRoot: () => !0
}), qr = {
  current: void 0
}, Q1 = /* @__PURE__ */ q1({
  measureScroll: (i) => ({
    x: i.scrollLeft,
    y: i.scrollTop
  }),
  defaultParent: () => {
    if (!qr.current) {
      const i = new $w({});
      i.mount(window), i.setOptions({ layoutScroll: !0 }), qr.current = i;
    }
    return qr.current;
  },
  resetTransform: (i, a) => {
    i.style.transform = a !== void 0 ? a : "none";
  },
  checkIsScrollRoot: (i) => window.getComputedStyle(i).position === "fixed"
}), tC = /* @__PURE__ */ new WeakMap();
function gu(i) {
  return i !== null && typeof i == "object" && typeof i.start == "function";
}
function Fs(i) {
  return typeof i == "string" || Array.isArray(i);
}
const yu = [
  "animate",
  "whileInView",
  "whileFocus",
  "whileHover",
  "whileTap",
  "whileDrag",
  "whilePinch",
  "exit"
], Kv = /* @__PURE__ */ ["initial"].concat(yu);
function vu(i) {
  if (gu(i.animate))
    return !0;
  for (let a = 0; a < Kv.length; a++)
    if (Fs(i[Kv[a]]))
      return !0;
  return !1;
}
function Z1(i) {
  return !!(vu(i) || i.variants);
}
function eC(i, a, s) {
  for (const o in a) {
    const c = a[o], d = s[o];
    if (me(c))
      i.addValue(o, c);
    else if (me(d))
      i.addValue(o, Aa(c, { owner: i }));
    else if (d !== c)
      if (i.hasValue(o)) {
        const f = i.getValue(o);
        f.liveStyle === !0 ? f.jump(c) : f.hasAnimated || f.set(c);
      } else {
        const f = i.getStaticValue(o);
        i.addValue(o, Aa(f !== void 0 ? f : c, { owner: i }));
      }
  }
  for (const o in s)
    a[o] === void 0 && i.removeValue(o);
  return a;
}
const lu = { current: null }, Qh = { current: !1 }, nC = typeof window < "u";
function K1() {
  if (Qh.current = !0, !!nC)
    if (window.matchMedia) {
      const i = window.matchMedia("(prefers-reduced-motion)"), a = () => lu.current = i.matches;
      i.addEventListener("change", a), a();
    } else
      lu.current = !1;
}
const kv = [
  "AnimationStart",
  "AnimationComplete",
  "Update",
  "BeforeLayoutMeasure",
  "LayoutMeasure",
  "LayoutAnimationStart",
  "LayoutAnimationComplete"
];
let su = {};
function k1(i) {
  su = i;
}
function iC() {
  return su;
}
class aC {
  /**
   * This method takes React props and returns found MotionValues. For example, HTML
   * MotionValues will be found within the style prop, whereas for Three.js within attribute arrays.
   *
   * This isn't an abstract method as it needs calling in the constructor, but it is
   * intended to be one.
   */
  scrapeMotionValuesFromProps(a, s, o) {
    return {};
  }
  constructor({ parent: a, props: s, presenceContext: o, reducedMotionConfig: c, skipAnimations: d, blockInitialAnimation: f, visualState: h }, p = {}) {
    this.current = null, this.children = /* @__PURE__ */ new Set(), this.isVariantNode = !1, this.isControllingVariants = !1, this.shouldReduceMotion = null, this.shouldSkipAnimations = !1, this.values = /* @__PURE__ */ new Map(), this.KeyframeResolver = _h, this.features = {}, this.valueSubscriptions = /* @__PURE__ */ new Map(), this.prevMotionValues = {}, this.hasBeenMounted = !1, this.events = {}, this.propEventSubscriptions = {}, this.notifyUpdate = () => this.notify("Update", this.latestValues), this.render = () => {
      this.current && (this.triggerBuild(), this.renderInstance(this.current, this.renderState, this.props.style, this.projection));
    }, this.renderScheduledAt = 0, this.scheduleRender = () => {
      const E = Gt.now();
      this.renderScheduledAt < E && (this.renderScheduledAt = E, qt.render(this.render, !1, !0));
    };
    const { latestValues: g, renderState: v } = h;
    this.latestValues = g, this.baseTarget = { ...g }, this.initialValues = s.initial ? { ...g } : {}, this.renderState = v, this.parent = a, this.props = s, this.presenceContext = o, this.depth = a ? a.depth + 1 : 0, this.reducedMotionConfig = c, this.skipAnimationsConfig = d, this.options = p, this.blockInitialAnimation = !!f, this.isControllingVariants = vu(s), this.isVariantNode = Z1(s), this.isVariantNode && (this.variantChildren = /* @__PURE__ */ new Set()), this.manuallyAnimateOnMount = !!(a && a.current);
    const { willChange: y, ...S } = this.scrapeMotionValuesFromProps(s, {}, this);
    for (const E in S) {
      const A = S[E];
      g[E] !== void 0 && me(A) && A.set(g[E]);
    }
  }
  mount(a) {
    var o, c, d, f;
    const s = this.presenceContext;
    if (this.hasBeenMounted && (s == null ? void 0 : s.isPresent) !== !1 && !(s != null && s.keepValuesOnRemount))
      for (const h in this.initialValues)
        (o = this.values.get(h)) == null || o.jump(this.initialValues[h]), this.latestValues[h] = this.initialValues[h];
    if (this.current = a, tC.set(a, this), (c = this.projection) != null && c.instance || ((d = this.projection) == null || d.mount(a)), this.isVariantNode && !this.isControllingVariants) {
      let h = this;
      do
        h = h.props.inherit !== !1 && h.parent;
      while (h && !h.isVariantNode);
      if (h) {
        const { variantChildren: p } = h;
        p.add(this), this.removeFromVariantTree = () => p.delete(this);
      }
    }
    this.values.forEach((h, p) => this.bindToMotionValue(p, h)), this.reducedMotionConfig === "never" ? this.shouldReduceMotion = !1 : this.reducedMotionConfig === "always" ? this.shouldReduceMotion = !0 : (Qh.current || K1(), this.shouldReduceMotion = lu.current), this.shouldSkipAnimations = this.skipAnimationsConfig ?? !1, (f = this.parent) == null || f.addChild(this), this.update(this.props, this.presenceContext), this.hasBeenMounted = !0;
  }
  unmount() {
    var a, s, o;
    (a = this.projection) == null || a.unmount(), Ye(this.notifyUpdate), Ye(this.render), this.valueSubscriptions.forEach((c) => c()), this.valueSubscriptions.clear(), (s = this.removeFromVariantTree) == null || s.call(this), (o = this.parent) == null || o.removeChild(this);
    for (const c in this.events)
      this.events[c].clear();
    for (const c in this.features) {
      const d = this.features[c];
      d && (d.unmount(), d.isMounted = !1);
    }
    this.current = null;
  }
  addChild(a) {
    this.children.add(a), (this.enteringChildren || (this.enteringChildren = /* @__PURE__ */ new Set())).add(a);
  }
  removeChild(a) {
    var s;
    this.children.delete(a), (s = this.enteringChildren) == null || s.delete(a);
  }
  bindToMotionValue(a, s) {
    var f;
    if ((f = this.valueSubscriptions.get(a)) == null || f(), s.accelerate && Kd.has(a) && this.current instanceof HTMLElement) {
      const { factory: h, keyframes: p, times: g, ease: v, duration: y } = s.accelerate, S = new m1({
        element: this.current,
        name: a,
        keyframes: p,
        times: g,
        ease: v,
        duration: /* @__PURE__ */ Oe(y)
      }), E = h(S);
      this.valueSubscriptions.set(a, () => {
        E(), S.cancel();
      });
      return;
    }
    const o = Gi.has(a);
    o && this.onBindTransform && this.onBindTransform();
    const c = s.on("change", (h) => {
      var p;
      this.latestValues[a] = h, this.props.onUpdate && qt.preRender(this.notifyUpdate), o && (this.projection && (this.projection.isTransformDirty = !0), (p = Cl.get(this.current)) == null || p.check()), this.scheduleRender();
    });
    let d;
    typeof window < "u" && window.MotionCheckAppearSync && (d = window.MotionCheckAppearSync(this, a, s)), this.valueSubscriptions.set(a, () => {
      c(), d == null || d();
    });
  }
  sortNodePosition(a) {
    return !this.current || !a.current || !this.sortInstanceNodePosition || this.type !== a.type ? 0 : this.sortInstanceNodePosition(this.current, a.current);
  }
  updateFeatures() {
    let a = "animation";
    for (a in su) {
      const s = su[a];
      if (!s)
        continue;
      const { isEnabled: o, Feature: c } = s;
      if (!this.features[a] && c && o(this.props) && (this.features[a] = new c(this)), this.features[a]) {
        const d = this.features[a];
        d.isMounted ? d.update() : (d.mount(), d.isMounted = !0);
      }
    }
  }
  triggerBuild() {
    this.build(this.renderState, this.latestValues, this.props);
  }
  /**
   * Measure the current viewport box with or without transforms.
   * Only measures axis-aligned boxes, rotate and skew must be manually
   * removed with a re-render to work.
   */
  measureViewportBox() {
    return this.current ? this.measureInstanceViewportBox(this.current, this.props) : de();
  }
  getStaticValue(a) {
    return this.latestValues[a];
  }
  setStaticValue(a, s) {
    this.latestValues[a] = s;
  }
  /**
   * Update the provided props. Ensure any newly-added motion values are
   * added to our map, old ones removed, and listeners updated.
   */
  update(a, s) {
    var d, f, h, p;
    const { transformTemplate: o, onUpdate: c } = this.props;
    (a.transformTemplate || o) && this.scheduleRender(), (a.transformTemplate && !o || a.onUpdate && !c) && ((d = Cl.get(this.current)) == null || d.demote()), this.prevProps = this.props, this.props = a, this.prevPresenceContext = this.presenceContext, this.presenceContext = s;
    for (let g = 0; g < kv.length; g++) {
      const v = kv[g];
      (h = (f = this.propEventSubscriptions)[v]) == null || h.call(f), delete this.propEventSubscriptions[v];
      const y = "on" + v, S = a[y];
      S && (this.propEventSubscriptions[v] = this.on(v, S));
    }
    this.prevMotionValues = eC(this, this.scrapeMotionValuesFromProps(a, this.prevProps || {}, this), this.prevMotionValues), (p = this.handleChildMotionValue) == null || p.call(this);
  }
  getProps() {
    return this.props;
  }
  /**
   * Returns the variant definition with a given name.
   */
  getVariant(a) {
    var s;
    return (s = this.props.variants) == null ? void 0 : s[a];
  }
  /**
   * Returns the defined default transition on this component.
   */
  getDefaultTransition() {
    return this.props.transition;
  }
  getTransformPagePoint() {
    return this.props.transformPagePoint;
  }
  /**
   * Add a motion value and bind it to this visual element.
   */
  addValue(a, s) {
    const o = this.values.get(a);
    if (s !== o) {
      o && this.removeValue(a), this.bindToMotionValue(a, s), this.values.set(a, s);
      const c = s.get();
      c !== void 0 && (this.latestValues[a] = c);
    }
  }
  /**
   * Remove a motion value and unbind any active subscriptions.
   */
  removeValue(a) {
    var s;
    this.values.delete(a), (s = this.valueSubscriptions.get(a)) == null || s(), this.valueSubscriptions.delete(a), delete this.latestValues[a], this.removeValueFromRenderState(a, this.renderState);
  }
  /**
   * Check whether we have a motion value for this key
   */
  hasValue(a) {
    return this.values.has(a);
  }
  getValue(a, s) {
    var c, d;
    let o = (c = this.props.values) == null ? void 0 : c[a];
    return o || (o = this.values.get(a), o === void 0 && s !== void 0 && (o = Aa(s ?? ((d = this.getDefaultValue) == null ? void 0 : d.call(this, a)), {
      owner: this
    }), this.addValue(a, o)), o);
  }
  /**
   * If we're trying to animate to a previously unencountered value,
   * we need to check for it in our state and as a last resort read it
   * directly from the instance (which might have performance implications).
   */
  readValue(a, s) {
    let o = this.latestValues[a] !== void 0 || !this.current ? this.latestValues[a] : this.getBaseTargetFromProps(this.props, a) ?? this.readValueFromInstance(this.current, a, this.options);
    return o != null && (typeof o == "string" && (gh(o) || yh(o)) ? o = parseFloat(o) : (
      /**
       * If the value as read isn't animatable (e.g. "none") but
       * the target is, derive an animatable none from the target.
       * A value is animatable if it's a number or contains a
       * number or color, which is cheaper to check than trying
       * every value type in turn.
       */
      typeof o != "number" && !dn.test(o) && dn.test(s) && (o = Rh(a, s))
    ), this.setBaseTarget(a, me(o) ? o.get() : o)), me(o) ? o.get() : o;
  }
  /**
   * Set the base target to later animate back to. This is currently
   * only hydrated on creation and when we first read a value.
   */
  setBaseTarget(a, s) {
    this.baseTarget[a] = s;
  }
  on(a, s) {
    return (this.events[a] || (this.events[a] = new Jr())).add(s);
  }
  notify(a, ...s) {
    var o;
    (o = this.events[a]) == null || o.notify(...s);
  }
  scheduleRenderMicrotask() {
    Xh.render(this.render);
  }
}
class P1 extends aC {
  constructor() {
    super(...arguments), this.KeyframeResolver = J2;
  }
  sortInstanceNodePosition(a, s) {
    return a.compareDocumentPosition(s) & 2 ? 1 : -1;
  }
  getBaseTargetFromProps(a, s) {
    const o = a.style;
    return o ? o[s] : void 0;
  }
  removeValueFromRenderState(a, { vars: s, style: o }) {
    delete s[a], delete o[a];
  }
  handleChildMotionValue() {
    this.childSubscription && (this.childSubscription(), delete this.childSubscription);
    const { children: a } = this.props;
    me(a) && (this.childSubscription = a.on("change", (s) => {
      this.current && (this.current.textContent = `${s}`);
    }));
  }
}
function J1(i, { style: a, vars: s }, o, c) {
  const d = i.style;
  let f;
  for (f in a)
    d[f] = a[f];
  c == null || c.applyProjectionStyles(d, o);
  for (f in s)
    d.setProperty(f, s[f]);
}
function F1(i, { layout: a, layoutId: s }) {
  return Gi.has(i) || i.startsWith("origin") || (a || s !== void 0) && (!!Bs[i] || i === "opacity");
}
function Zh(i, a, s) {
  var f;
  const o = i.style, c = a == null ? void 0 : a.style, d = {};
  if (!o)
    return d;
  for (const h in o)
    (me(o[h]) || c && me(c[h]) || F1(h, i) || ((f = s == null ? void 0 : s.getValue(h)) == null ? void 0 : f.liveStyle) !== void 0) && (d[h] = o[h]);
  return d;
}
function lC(i) {
  return window.getComputedStyle(i);
}
class sC extends P1 {
  constructor() {
    super(...arguments), this.type = "html", this.renderInstance = J1;
  }
  mount(a) {
    super.mount(a);
  }
  readValueFromInstance(a, s) {
    var o;
    if (Gi.has(s))
      return (o = this.projection) != null && o.isProjecting ? Js(s) : GM(a, s);
    {
      const c = lC(a), d = (qb(s) ? c.getPropertyValue(s) : c[s]) || 0;
      return typeof d == "string" ? d.trim() : d;
    }
  }
  measureInstanceViewportBox(a, { transformPagePoint: s }) {
    return V1(a, s);
  }
  build(a, s, o) {
    qh(a, s, o.transformTemplate);
  }
  scrapeMotionValuesFromProps(a, s, o) {
    return Zh(a, s, o);
  }
}
const Is = (i) => i.pointerType === "mouse" ? typeof i.button != "number" || i.button <= 0 : i.isPrimary !== !1;
function Kh(i) {
  return {
    point: {
      x: i.pageX,
      y: i.pageY
    }
  };
}
const oC = (i) => (a) => Is(a) && i(a, Kh(a));
function Gs(i, a, s, o) {
  return xa(i, a, oC(s), o);
}
const Xr = /* @__PURE__ */ new WeakMap();
let Bi;
const I1 = (i, a, s) => (o, c) => c && c[0] ? c[0][i + "Size"] : Gh(o) && "getBBox" in o ? o.getBBox()[a] : o[s], rC = /* @__PURE__ */ I1("inline", "width", "offsetWidth"), uC = /* @__PURE__ */ I1("block", "height", "offsetHeight");
function cC({ target: i, borderBoxSize: a }) {
  var s;
  (s = Xr.get(i)) == null || s.forEach((o) => {
    o(i, {
      get width() {
        return rC(i, a);
      },
      get height() {
        return uC(i, a);
      }
    });
  });
}
function fC(i) {
  i.forEach(cC);
}
function dC() {
  typeof ResizeObserver > "u" || (Bi = new ResizeObserver(fC));
}
function hC(i, a) {
  Bi || dC();
  const s = Yh(i);
  return s.forEach((o) => {
    let c = Xr.get(o);
    c || (c = /* @__PURE__ */ new Set(), Xr.set(o, c)), c.add(a), Bi == null || Bi.observe(o);
  }), () => {
    s.forEach((o) => {
      const c = Xr.get(o);
      c == null || c.delete(a), c != null && c.size || Bi == null || Bi.unobserve(o);
    });
  };
}
const Qr = /* @__PURE__ */ new Set();
let Al;
function mC() {
  Al = () => {
    const i = {
      get width() {
        return window.innerWidth;
      },
      get height() {
        return window.innerHeight;
      }
    };
    Qr.forEach((a) => a(i));
  }, window.addEventListener("resize", Al);
}
function pC(i) {
  return Qr.add(i), Al || mC(), () => {
    Qr.delete(i), !Qr.size && typeof Al == "function" && (window.removeEventListener("resize", Al), Al = void 0);
  };
}
function Pv(i, a) {
  return mu(typeof i == "function" ? pC(i) : hC(i, a));
}
const Jv = (i, a) => Math.abs(i - a);
function gC(i, a) {
  const s = Jv(i.x, a.x), o = Jv(i.y, a.y);
  return Math.sqrt(s ** 2 + o ** 2);
}
const Fv = /* @__PURE__ */ new Set(["auto", "scroll"]);
class W1 {
  constructor(a, s, { transformPagePoint: o, contextWindow: c = window, dragSnapToOrigin: d = !1, distanceThreshold: f = 3, element: h, immediate: p } = {}) {
    if (this.startEvent = null, this.lastMoveEvent = null, this.lastMoveEventInfo = null, this.lastRawMoveEventInfo = null, this.handlers = {}, this.contextWindow = window, this.scrollPositions = /* @__PURE__ */ new Map(), this.onElementScroll = (A) => {
      this.handleScroll(A.target);
    }, this.onWindowScroll = () => {
      this.handleScroll(window);
    }, this.updatePoint = () => {
      if (!(this.lastMoveEvent && this.lastMoveEventInfo))
        return;
      this.hasPendingMove = !1, this.lastRawMoveEventInfo && (this.lastMoveEventInfo = Vr(this.lastRawMoveEventInfo, this.transformPagePoint));
      const A = Sd(this.lastMoveEventInfo, this.history), w = this.startEvent !== null, M = gC(A.offset, { x: 0, y: 0 }) >= this.distanceThreshold;
      if (!w && !M)
        return;
      const { point: C } = A;
      this.history.push({ ...C, timestamp: Gt.now() });
      const { onStart: N, onMove: H } = this.handlers;
      w || (N == null || N(this.lastMoveEvent, A), this.startEvent = this.lastMoveEvent), H == null || H(this.lastMoveEvent, A);
    }, this.handlePointerMove = (A, w) => {
      this.handleScroll(window), this.lastMoveEvent = A, this.lastRawMoveEventInfo = w, this.lastMoveEventInfo = Vr(w, this.transformPagePoint), this.hasPendingMove = !0, qt.update(this.updatePoint, !0);
    }, this.handlePointerUp = (A, w) => {
      this.hasPendingMove && this.updatePoint(), this.end();
      const { onEnd: M, onSessionEnd: C, resumeAnimation: N } = this.handlers;
      if ((this.dragSnapToOrigin || !this.startEvent) && (N == null || N()), !(this.lastMoveEvent && this.lastMoveEventInfo))
        return;
      const H = Sd(A.type === "pointercancel" ? this.lastMoveEventInfo : Vr(w, this.transformPagePoint), this.history);
      this.startEvent && (M == null || M(A, H)), C == null || C(A, H);
    }, !Is(a))
      return;
    this.dragSnapToOrigin = d, this.handlers = s, this.transformPagePoint = o, this.distanceThreshold = p ? 0 : f, this.contextWindow = c || window;
    const g = Kh(a), v = Vr(g, this.transformPagePoint), { point: y } = v;
    this.history = [{ ...y, timestamp: Gt.now() }];
    const { onSessionStart: S } = s;
    S && S(a, Sd(v, this.history));
    const E = { passive: !0, capture: !0 };
    this.removeListeners = Ml(Gs(this.contextWindow, "pointermove", this.handlePointerMove, E), Gs(this.contextWindow, "pointerup", this.handlePointerUp, E), Gs(this.contextWindow, "pointercancel", this.handlePointerUp, E)), h && this.startScrollTracking(h), p && (this.handlePointerMove(a, g), this.updatePoint());
  }
  /**
   * Start tracking scroll on ancestors and window.
   */
  startScrollTracking(a) {
    let s = a.parentElement;
    for (; s; ) {
      const o = getComputedStyle(s);
      (Fv.has(o.overflowX) || Fv.has(o.overflowY)) && this.scrollPositions.set(s, bd(s)), s = s.parentElement;
    }
    this.scrollPositions.set(window, bd(window)), this.removeScrollListeners = Ml(
      // Capture listener catches element scroll events as they bubble
      xa(window, "scroll", this.onElementScroll, {
        capture: !0
      }),
      // Direct window scroll listener (window scroll doesn't bubble)
      xa(window, "scroll", this.onWindowScroll, {})
    );
  }
  /**
   * Handle scroll compensation during drag.
   *
   * For element scroll: adjusts history origin since pageX/pageY doesn't change.
   * For window scroll: adjusts lastMoveEventInfo since pageX/pageY would change.
   */
  handleScroll(a) {
    const s = this.scrollPositions.get(a);
    if (!s)
      return;
    const o = a === window, c = bd(a), d = { x: c.x - s.x, y: c.y - s.y };
    d.x === 0 && d.y === 0 || (o ? this.lastMoveEventInfo && (this.lastMoveEventInfo.point.x += d.x, this.lastMoveEventInfo.point.y += d.y) : this.history.length > 0 && (this.history[0].x -= d.x, this.history[0].y -= d.y), this.scrollPositions.set(a, c), qt.update(this.updatePoint, !0));
  }
  updateHandlers(a) {
    this.handlers = a;
  }
  end() {
    var a, s;
    (a = this.removeListeners) == null || a.call(this), (s = this.removeScrollListeners) == null || s.call(this), this.scrollPositions.clear(), Ye(this.updatePoint);
  }
}
const bd = (i) => i === window ? { x: window.scrollX, y: window.scrollY } : {
  x: i.scrollLeft,
  y: i.scrollTop
};
function Vr(i, a) {
  return a ? { point: a(i.point) } : i;
}
function Iv(i, a) {
  return { x: i.x - a.x, y: i.y - a.y };
}
function Sd({ point: i }, a) {
  return {
    point: i,
    delta: Iv(i, $1(a)),
    offset: Iv(i, yC(a)),
    velocity: vC(a, 0.1)
  };
}
function yC(i) {
  return i[0];
}
function $1(i) {
  return i[i.length - 1];
}
function vC(i, a) {
  if (i.length < 2)
    return { x: 0, y: 0 };
  let s = i.length - 1, o = null;
  const c = $1(i);
  for (; s >= 0 && (o = i[s], !(c.timestamp - o.timestamp > /* @__PURE__ */ Oe(a))); )
    s--;
  if (!o)
    return { x: 0, y: 0 };
  o === i[0] && i.length > 2 && c.timestamp - o.timestamp > /* @__PURE__ */ Oe(a) * 2 && (o = i[1]);
  const d = /* @__PURE__ */ $e(c.timestamp - o.timestamp);
  if (d === 0)
    return { x: 0, y: 0 };
  const f = {
    x: (c.x - o.x) / d,
    y: (c.y - o.y) / d
  };
  return f.x === 1 / 0 && (f.x = 0), f.y === 1 / 0 && (f.y = 0), f;
}
const bC = /* @__PURE__ */ new Set([
  "BUTTON",
  "INPUT",
  "SELECT",
  "TEXTAREA",
  "A"
]);
function SC(i) {
  return bC.has(i.tagName) || i.isContentEditable === !0;
}
const TC = /* @__PURE__ */ new Set(["INPUT", "SELECT", "TEXTAREA"]);
function EC(i) {
  return TC.has(i.tagName) || i.isContentEditable === !0;
}
const Sn = {
  x: !1,
  y: !1
};
function ou() {
  return Sn.x || Sn.y;
}
function AC(i) {
  return i === "x" || i === "y" ? Sn[i] ? null : (Sn[i] = !0, () => {
    Sn[i] = !1;
  }) : Sn.x || Sn.y ? null : (Sn.x = Sn.y = !0, () => {
    Sn.x = Sn.y = !1;
  });
}
function xC(i, { min: a, max: s }, o) {
  return a !== void 0 && i < a ? i = o ? Jt(a, i, o.min) : Math.max(i, a) : s !== void 0 && i > s && (i = o ? Jt(s, i, o.max) : Math.min(i, s)), i;
}
function Wv(i, a, s) {
  return {
    min: a !== void 0 ? i.min + a : void 0,
    max: s !== void 0 ? i.max + s - (i.max - i.min) : void 0
  };
}
function MC(i, { top: a, left: s, bottom: o, right: c }) {
  return {
    x: Wv(i.x, s, c),
    y: Wv(i.y, a, o)
  };
}
function $v(i, a) {
  let s = a.min - i.min, o = a.max - i.max;
  return a.max - a.min < i.max - i.min && ([s, o] = [o, s]), { min: s, max: o };
}
function wC(i, a) {
  return {
    x: $v(i.x, a.x),
    y: $v(i.y, a.y)
  };
}
function CC(i, a) {
  let s = 0.5;
  const o = De(i), c = De(a);
  return c > o ? s = /* @__PURE__ */ Ea(a.min, a.max - o, i.min) : o > c && (s = /* @__PURE__ */ Ea(i.min, i.max - c, a.min)), Gn(0, 1, s);
}
function DC(i, a) {
  const s = {};
  return a.min !== void 0 && (s.min = a.min - i.min), a.max !== void 0 && (s.max = a.max - i.min), s;
}
const th = 0.35;
function OC(i = th) {
  return i === !1 ? i = 0 : i === !0 && (i = th), {
    x: tb(i, "left", "right"),
    y: tb(i, "top", "bottom")
  };
}
function tb(i, a, s) {
  return {
    min: eb(i, a),
    max: eb(i, s)
  };
}
function eb(i, a) {
  return typeof i == "number" ? i : i[a] || 0;
}
function nb(i) {
  let a = "";
  for (const s of i.path) {
    s.scroll = void 0, s.updateScroll();
    const { scroll: o } = s;
    s !== i.root && o && (a += o.offset.x + "," + o.offset.y + ",");
  }
  return a;
}
const zC = /* @__PURE__ */ new WeakMap();
class RC {
  constructor(a, s = () => a.getProps()) {
    this.openDragLock = null, this.isDragging = !1, this.currentDirection = null, this.originPoint = { x: 0, y: 0 }, this.constraints = !1, this.hasMutatedConstraints = !1, this.elastic = de(), this.latestPointerEvent = null, this.latestPanInfo = null, this.visualElement = a, this.readProps = s;
  }
  start(a, s = {}) {
    var g, v;
    if (((g = this.visualElement.presenceContext) == null ? void 0 : g.isPresent) === !1)
      return;
    const o = (y) => {
      s.snapToCursor && this.snapToCursor(y), this.stopAnimation();
    }, c = (y, S) => {
      var N, H;
      const { drag: E, dragConstraints: A, dragPropagation: w, onDragStart: M } = this.getProps();
      if (E && !w && ((N = this.openDragLock) == null || N.call(this), this.openDragLock = AC(E), !this.openDragLock))
        return;
      this.latestPointerEvent = y, this.latestPanInfo = S, this.isDragging = !0, this.currentDirection = null, this.resolveConstraints();
      const { projection: C } = this.visualElement;
      C && (C.isAnimationBlocked = !0, C.target = void 0), Tn((X) => {
        var et;
        let I = this.getAxisMotionValue(X).get() || 0;
        if (du(I) && (I = Hh(I, this.visualElement.current) || 0), gt.test(I))
          I = parseFloat(I);
        else if (jn.test(I)) {
          const z = (et = C == null ? void 0 : C.layout) == null ? void 0 : et.layoutBox[X];
          z && (I = De(z) * (parseFloat(I) / 100));
        }
        this.originPoint[X] = I;
      }), this.point = typeof A == "function" && A(this), M && qt.update(() => M(y, S), !1, !0), Jd(this.visualElement, "transform"), (H = this.visualElement.animationState) == null || H.setActive("whileDrag", !0);
    }, d = (y, S) => {
      this.latestPointerEvent = y, this.latestPanInfo = S;
      const { dragPropagation: E, dragDirectionLock: A, onDirectionLock: w, onDrag: M } = this.getProps();
      if (!E && !this.openDragLock)
        return;
      const { offset: C } = S;
      if (A && this.currentDirection === null) {
        if (this.currentDirection = _C(C), this.currentDirection === null)
          return;
        w && w(this.currentDirection);
      }
      this.updateAxis("x", C), this.updateAxis("y", C), this.point && this.point.move(), this.visualElement.render(), M && qt.update(() => M(y, S), !1, !0);
    }, f = (y, S) => {
      this.latestPointerEvent = y, this.latestPanInfo = S, this.stop(y, S), this.latestPointerEvent = null, this.latestPanInfo = null;
    }, h = () => {
      const { dragSnapToOrigin: y } = this.getProps();
      (y || this.constraints || this.point) && this.startAnimation({ x: 0, y: 0 });
    }, { dragSnapToOrigin: p } = this.getProps();
    this.panSession = new W1(a, {
      onSessionStart: o,
      onStart: c,
      onMove: d,
      onSessionEnd: f,
      resumeAnimation: h
    }, {
      ...s,
      transformPagePoint: this.visualElement.getTransformPagePoint(),
      dragSnapToOrigin: p,
      contextWindow: (v = this.visualElement.current) == null ? void 0 : v.ownerDocument.defaultView,
      element: this.visualElement.current
    });
  }
  /**
   * @param dragAxes - The axes to animate on release, if not the `drag`
   * prop's, e.g. when drag was disabled mid-gesture.
   */
  stop(a, s, o) {
    const c = a || this.latestPointerEvent, d = s || this.latestPanInfo, f = this.isDragging;
    if (this.cancel(), !f || !d || !c)
      return;
    const { velocity: h } = d;
    this.startAnimation(h, o);
    const { onDragEnd: p } = this.getProps();
    p && qt.postRender(() => p(c, d));
  }
  cancel() {
    this.isDragging = !1;
    const { projection: a, animationState: s } = this.visualElement;
    a && (a.isAnimationBlocked = !1), this.endPanSession(), !this.getProps().dragPropagation && this.openDragLock && (this.openDragLock(), this.openDragLock = null), s == null || s.setActive("whileDrag", !1);
  }
  /**
   * Clean up the pan session without modifying other drag state.
   * This is used during unmount to ensure event listeners are removed
   * without affecting projection animations or drag locks.
   */
  endPanSession() {
    var a;
    (a = this.panSession) == null || a.end(), this.panSession = void 0;
  }
  updateAxis(a, s) {
    const { drag: o } = this.readProps();
    if (!s || !vl(a, o, this.currentDirection))
      return;
    const c = this.getAxisMotionValue(a);
    let d = this.originPoint[a] + s[a];
    const f = this.constraints && this.constraints[a];
    f && (d = xC(d, f, this.elastic[a])), this.point ? this.point[a] = d : c.set(d);
  }
  resolveConstraints() {
    const { dragConstraints: a, dragElastic: s } = this.getProps(), { projection: o } = this.visualElement, c = o && (o.layout || o.measure(!1)), d = this.constraints;
    Vs(a) ? (!this.constraints || this.scroll !== nb(o)) && (this.constraints = this.resolveRefConstraints()) : a && c && typeof a == "object" ? this.constraints = MC(c.layoutBox, a) : this.constraints = !1, this.elastic = OC(s), d !== this.constraints && !Vs(a) && c && this.constraints && !this.hasMutatedConstraints && Tn((f) => {
      this.constraints !== !1 && this.getAxisMotionValue(f) && (this.constraints[f] = DC(c.layoutBox[f], this.constraints[f]));
    });
  }
  resolveRefConstraints() {
    const { dragConstraints: a, onMeasureDragConstraints: s } = this.getProps();
    if (!Vs(a))
      return !1;
    const o = ib(a), { projection: c } = this.visualElement;
    if (!c || !c.layout)
      return !1;
    this.scroll = nb(c);
    const d = iw(o, c.root, this.visualElement.getTransformPagePoint());
    let f = wC(c.layout.layoutBox, c.removeElementScroll(d));
    if (s) {
      const h = s(tw(f));
      this.hasMutatedConstraints = !!h, h && (f = z1(h));
    }
    return f;
  }
  startAnimation(a, s) {
    const { drag: o, dragMomentum: c, dragElastic: d, dragTransition: f, dragSnapToOrigin: h, onDragTransitionEnd: p } = this.getProps(), g = {
      bounceStiffness: d ? 200 : 1e6,
      bounceDamping: d ? 40 : 1e7,
      timeConstant: 750,
      restDelta: 1,
      restSpeed: 10,
      ...f
    }, v = (E) => c && !(this.point && h) && vl(E, s || o, this.currentDirection) ? a[E] : 0;
    if (this.point && !h)
      return this.point.release({ x: v("x"), y: v("y") }, g).then(p);
    const y = this.constraints || {}, S = Tn((E) => {
      if (!vl(E, s || o, this.currentDirection))
        return;
      let A = y[E] || {};
      (h === !0 || h === E) && (A = { min: 0, max: 0 });
      const w = {
        type: "inertia",
        velocity: v(E),
        ...g,
        ...A
      };
      return this.startAxisValueAnimation(E, w);
    });
    return Promise.all(S).then(p);
  }
  startAxisValueAnimation(a, s) {
    const o = this.getAxisMotionValue(a);
    return Jd(this.visualElement, a), o.start(Bh(a, o, 0, s, this.visualElement, !1));
  }
  stopAnimation() {
    Tn((a) => this.getAxisMotionValue(a).stop());
  }
  /**
   * Drag works differently depending on which props are provided.
   *
   * - If _dragX and _dragY are provided, we output the gesture delta directly to those motion values.
   * - Otherwise, we apply the delta to the x/y motion values.
   */
  getAxisMotionValue(a) {
    const s = `_drag${a.toUpperCase()}`, c = this.readProps()[s];
    return c || this.visualElement.getValue(a, this.visualElement.latestValues[a] ?? 0);
  }
  /**
   * Measure the live box - projection.layout may or may not include the
   * drag transform, depending on when it was measured.
   */
  snapToCursor({ clientX: a, clientY: s }) {
    var h;
    const { drag: o } = this.getProps(), c = { x: a, y: s }, d = ((h = this.visualElement.getTransformPagePoint()) == null ? void 0 : h(c)) || c, f = this.visualElement.measureViewportBox();
    Tn((p) => {
      if (!vl(p, o, this.currentDirection))
        return;
      const g = this.getAxisMotionValue(p), { min: v, max: y } = f[p];
      g.set((g.get() || 0) + d[p] - Jt(v, y, 0.5));
    });
  }
  /**
   * When the viewport resizes we want to check if the measured constraints
   * have changed and, if so, reposition the element within those new constraints
   * relative to where it was before the resize.
   */
  scalePositionWithinConstraints() {
    var h;
    if (!this.visualElement.current)
      return;
    const { drag: a, dragConstraints: s } = this.getProps(), { projection: o } = this.visualElement;
    if (!Vs(s) || !o || !this.constraints)
      return;
    this.stopAnimation();
    const c = this.constraints, d = { x: 0, y: 0 };
    Tn((p) => {
      const g = this.getAxisMotionValue(p).get();
      d[p] = CC({ min: g, max: g }, c[p]);
    });
    const { transformTemplate: f } = this.visualElement.getProps();
    this.visualElement.current.style.transform = f ? f({}, "") : "none", (h = o.root) == null || h.updateScroll(), o.updateLayout(), this.constraints = !1, this.resolveConstraints(), Tn((p) => {
      const g = this.getAxisMotionValue(p);
      if (!vl(p, a, null) || !g.get())
        return;
      const { min: v, max: y } = this.constraints[p];
      g.set(Jt(v, y, d[p]));
    }), this.visualElement.render();
  }
  addListeners() {
    var g;
    if (!this.visualElement.current)
      return;
    zC.set(this.visualElement, this);
    const a = this.visualElement.current, s = Gs(a, "pointerdown", (v) => {
      const { drag: y, dragListener: S = !0 } = this.getProps(), E = v.target, A = E !== a && EC(E);
      y && S && !A && this.start(v);
    });
    let o;
    const c = () => {
      const { dragConstraints: v } = this.getProps(), y = Vs(v) && ib(v);
      y && (this.constraints = this.resolveRefConstraints(), o || (o = NC(a, y, () => this.scalePositionWithinConstraints())));
    }, { projection: d } = this.visualElement, f = d.addEventListener("measure", c);
    d.layout || ((g = d.root) == null || g.updateScroll(), d.updateLayout()), qt.read(c);
    const h = xa(window, "resize", () => this.scalePositionWithinConstraints()), p = d.addEventListener("didUpdate", (({ delta: v, hasLayoutChanged: y }) => {
      this.isDragging && y && (Tn((S) => {
        if (!vl(S, this.getProps().drag, this.currentDirection))
          return;
        const E = this.getAxisMotionValue(S);
        this.originPoint[S] += v[S].translate, E.set(E.get() + v[S].translate);
      }), this.visualElement.render());
    }));
    return () => {
      h(), s(), f(), p(), o == null || o();
    };
  }
  getProps() {
    const a = this.readProps(), { dragElastic: s = th, dragMomentum: o = !0 } = a;
    return { ...a, dragElastic: s, dragMomentum: o };
  }
}
function Vs(i) {
  return !!i && typeof i == "object" && ("current" in i || "nodeType" in i);
}
const ib = (i) => "current" in i ? i.current : i;
function ab(i) {
  let a = !0;
  return () => {
    if (a) {
      a = !1;
      return;
    }
    i();
  };
}
function NC(i, a, s) {
  const o = Pv(i, ab(s)), c = Pv(a, ab(s));
  return () => {
    o(), c();
  };
}
function vl(i, a, s) {
  return (a === !0 || a === i) && (s === null || s === i);
}
function _C(i, a = 10) {
  let s = null;
  return Math.abs(i.y) > a ? s = "y" : Math.abs(i.x) > a && (s = "x"), s;
}
function tS(i, a) {
  const s = Yh(i), o = new AbortController(), c = {
    passive: !0,
    ...a,
    signal: o.signal
  }, d = mu(() => o.abort());
  return [s, c, d];
}
function VC(i) {
  return !(i.pointerType === "touch" || ou());
}
function LC(i, a, s = {}) {
  a = pu(a);
  const [o, c, d] = tS(i, s);
  return o.forEach((f) => {
    let h = !1, p = !1, g;
    const v = () => {
      f.removeEventListener("pointerleave", A);
    }, y = (M) => {
      g && (g(M), g = void 0), v();
    }, S = (M) => {
      h = !1, window.removeEventListener("pointerup", S), window.removeEventListener("pointercancel", S), p && (p = !1, y(M));
    }, E = () => {
      h = !0, window.addEventListener("pointerup", S, c), window.addEventListener("pointercancel", S, c);
    }, A = (M) => {
      if (M.pointerType !== "touch") {
        if (h) {
          p = !0;
          return;
        }
        y(M);
      }
    }, w = (M) => {
      if (!VC(M))
        return;
      p = !1;
      const C = a(f, M);
      typeof C == "function" && (g = C, f.addEventListener("pointerleave", A, c));
    };
    f.addEventListener("pointerenter", w, c), f.addEventListener("pointerdown", E, c);
  }), d;
}
const eS = (i, a) => a ? i === a ? !0 : eS(i, a.parentElement) : !1, eh = /* @__PURE__ */ new WeakSet();
function lb(i) {
  return (a) => {
    a.key === "Enter" && i(a);
  };
}
function Td(i, a) {
  i.dispatchEvent(new PointerEvent("pointer" + a, { isPrimary: !0, bubbles: !0 }));
}
const UC = (i, a) => {
  let s = !1;
  const o = lb(() => {
    s || eh.has(i) || (s = !0, Td(i, "down"));
  }), c = lb(() => {
    s && (s = !1, Td(i, "up"));
  });
  i.addEventListener("keydown", o, a), i.addEventListener("keyup", c, a), i.addEventListener("blur", () => {
    i.removeEventListener("keydown", o), i.removeEventListener("keyup", c), s && Td(i, "cancel");
  }, { ...a, once: !0 });
};
function BC(i) {
  return Is(i) && !ou();
}
const sb = /* @__PURE__ */ new WeakSet(), HC = 100, jC = 8, ob = (i, a, s) => Math.hypot(i.clientX - a.clientX, i.clientY - a.clientY) > s, rb = (i) => i.preventDefault();
function GC(i, a, s = {}) {
  a = pu(a);
  const [o, c, d] = tS(i, s), f = /* @__PURE__ */ new WeakMap(), h = (p) => {
    var ut;
    const g = p.currentTarget;
    if (!BC(p) || sb.has(p))
      return;
    s.stopPropagation && sb.add(p);
    const { count: v = 1, countTimeout: y = 0.3, hold: S = 0, repeat: E } = s, A = Gt.now(), w = /* @__PURE__ */ Oe(S), M = /* @__PURE__ */ Oe(y);
    let C = f.get(g);
    C != null && C.expire(ob(C.event, p, HC)) ? C = void 0 : C && (Ye(C.expire), f.delete(g));
    const N = C ? C.count + 1 : 1, H = N >= v, X = H && (S || E);
    let I = !S, et = 0, z;
    if (eh.add(g), C)
      z = C.handlers;
    else {
      const nt = a(g, p);
      z = typeof nt == "function" ? { onComplete: nt } : nt || {};
    }
    H && I && ((ut = z.onActive) == null || ut.call(z));
    const D = /* @__PURE__ */ Oe(E);
    let at = w || D, lt = A + at, st = !0;
    const dt = () => {
      var L, K, $;
      if (c.signal.aborted)
        return Ye(dt);
      let nt = Math.min(1 - (lt - Gt.now()) / at, 1);
      st && nt < 1 && (nt = 0), st = !1, (L = z.onHold) == null || L.call(z, nt), !(nt < 1) && (I ? (K = z.onRepeat) == null || K.call(z, ++et) : (I = !0, ($ = z.onActive) == null || $.call(z)), E ? (st = !0, lt += at = D) : Ye(dt));
    }, vt = { ...c, capture: !0 }, xt = (nt, L) => {
      var K;
      if (Is(nt))
        if (window.removeEventListener("pointerup", St, vt), window.removeEventListener("pointercancel", F, vt), window.removeEventListener("pointermove", rt, vt), g.removeEventListener("contextmenu", rb), Ye(dt), eh.delete(g), ou() && (L = !1), L && !H) {
          const $ = Gt.now(), tt = (T) => {
            var k;
            const U = c.signal.aborted;
            if (U || T === !0 || Gt.now() - $ > M)
              return Ye(tt), f.delete(g), U || ((k = z.onComplete) == null || k.call(z, nt, { success: !1 })), !0;
          };
          f.set(g, {
            count: N,
            event: p,
            handlers: z,
            expire: tt
          }), qt.update(tt, !0);
        } else
          (K = z.onComplete) == null || K.call(z, nt, {
            success: L && I
          });
    }, St = (nt) => {
      xt(nt, g === window || g === document || s.useGlobalTarget || eS(g, nt.target));
    }, F = (nt) => {
      xt(nt, !1);
    }, rt = (nt) => {
      Is(nt) && ((E || !I) && ob(p, nt, jC) || v > 1 && ou()) && F(nt);
    };
    window.addEventListener("pointerup", St, vt), window.addEventListener("pointercancel", F, vt), (X || v > 1) && window.addEventListener("pointermove", rt, vt), X && (qt.update(dt, !0), g.addEventListener("contextmenu", rb, {
      ...c,
      passive: !1
    }));
  };
  return o.forEach((p) => {
    (s.useGlobalTarget ? window : p).addEventListener("pointerdown", h, c), F2(p) && (p.addEventListener("focus", () => UC(p, c), c), !SC(p) && !p.hasAttribute("tabindex") && (p.tabIndex = 0));
  }), d;
}
class Yi {
  constructor(a) {
    this.isMounted = !1, this.node = a;
  }
  update() {
  }
}
const nS = /* @__PURE__ */ new Set([
  "baseFrequency",
  "diffuseConstant",
  "kernelMatrix",
  "kernelUnitLength",
  "keySplines",
  "keyTimes",
  "limitingConeAngle",
  "markerHeight",
  "markerWidth",
  "numOctaves",
  "targetX",
  "targetY",
  "surfaceScale",
  "specularConstant",
  "specularExponent",
  "stdDeviation",
  "tableValues",
  "viewBox",
  "gradientTransform",
  "pathLength",
  "startOffset",
  "textLength",
  "lengthAdjust"
]), iS = (i) => typeof i == "string" && i.toLowerCase() === "svg";
function YC(i, a, s, o) {
  J1(i, a, void 0, o);
  for (const c in a.attrs)
    i.setAttribute(nS.has(c) ? c : C1(c), a.attrs[c]);
}
function aS(i, a, s) {
  const o = Zh(i, a, s);
  for (const c in i)
    if (c !== "children" && (me(i[c]) || me(a[c]))) {
      const d = si.indexOf(c) !== -1 ? "attr" + c.charAt(0).toUpperCase() + c.substring(1) : c;
      o[d] = i[c];
    }
  return o;
}
class qC extends P1 {
  constructor() {
    super(...arguments), this.type = "svg", this.isSVGTag = !1, this.measureInstanceViewportBox = de;
  }
  getBaseTargetFromProps(a, s) {
    return Gi.has(s) ? super.getBaseTargetFromProps(a, s) ?? Js(s) : a[s];
  }
  /**
   * An independent transform's origin is never read from the DOM, so it
   * starts from its latest or default value and renders on mount.
   */
  getDefaultValue(a) {
    return Gi.has(a) ? this.latestValues[a] ?? Js(a) : void 0;
  }
  readValueFromInstance(a, s) {
    if (Gi.has(s)) {
      const o = o1(s);
      return o && o.default || 0;
    }
    if (D1.includes(s)) {
      const c = getComputedStyle(a)[s];
      if (typeof c == "string" && c)
        return c.trim();
    }
    return s = nS.has(s) ? s : C1(s), a.getAttribute(s);
  }
  scrapeMotionValuesFromProps(a, s, o) {
    return aS(a, s, o);
  }
  build(a, s, o) {
    O1(a, s, this.isSVGTag, o.transformTemplate, o.style);
  }
  renderInstance(a, s, o, c) {
    YC(a, s, o, c);
  }
  mount(a) {
    this.isSVGTag = iS(a.tagName), super.mount(a);
  }
}
function lS(i, a) {
  if (!Array.isArray(a))
    return !1;
  const s = a.length;
  if (s !== i.length)
    return !1;
  for (let o = 0; o < s; o++)
    if (a[o] !== i[o])
      return !1;
  return !0;
}
const XC = [...yu].reverse(), ub = (i) => (i == null ? void 0 : i.out) === !0 ? i : i == null ? void 0 : i.out;
function QC(i) {
  let a = (h) => Promise.all(h.map(({ animation: p, options: g }) => q2(i, p, g))), s = cb(), o = !0, c = !1;
  function d(h) {
    var I;
    const { props: p, parent: g, manuallyAnimateOnMount: v } = i, { initial: y } = p, S = o || c, E = [], A = (et = y) => {
      var z;
      return typeof et != "boolean" && Sa(i, Array.isArray(et) ? et[0] : et, (z = i.presenceContext) == null ? void 0 : z.custom) || void 0;
    }, w = /* @__PURE__ */ new Map();
    let M = {}, C = 1 / 0, N = i;
    do
      N = N.props.inherit !== !1 && N.parent;
    while (N && !N.isControllingVariants);
    const H = S && ub((I = A(y ?? (N && N.props.initial))) == null ? void 0 : I.transition);
    if (XC.forEach((et, z) => {
      var $, tt;
      const D = s[et], at = p[et], lt = N && N.props[et], st = at !== void 0 ? at : Fs(lt) || lt === !1 ? lt : void 0, dt = Fs(st), vt = et === h ? D.isActive : null, xt = dt && at === void 0 && !(S && v);
      if (D.protectedKeys = { ...M }, !D.isActive && vt === null || !st && !D.prevProp || gu(st) || typeof st == "boolean")
        return;
      if (vt === !1 && (C = z), et === "exit" && D.isActive && vt !== !0) {
        M = {
          ...M,
          ...D.prevResolvedValues
        };
        return;
      }
      const St = ZC(D.prevProp, st);
      let F = St || dt && (vt && !xt || z > C), rt = !1;
      const ut = Array.isArray(st) ? st : [st];
      let nt = {}, L;
      if (vt !== !1)
        for (const T of ut) {
          const { transition: U, transitionEnd: k, ...J } = Sa(i, T, E1(i, et)) || {};
          nt = {
            ...nt,
            ...J,
            ...k
          }, L = ub(U) || L;
        }
      const { prevResolvedValues: K } = D;
      for (const T in { ...K, ...nt }) {
        if (T in M)
          continue;
        const U = nt[T], k = K[T], J = Array.isArray(U) && Array.isArray(k) ? !lS(U, k) || St : U !== k;
        let it;
        if (J && U == null)
          w.has(T) || w.set(T, D.prevOut);
        else if (J || U !== void 0 && w.has(T)) {
          F = !0, it = w.get(T) || H, w.delete(T) && (rt = !0), D.needsAnimating[T] = !0;
          const W = i.getValue(T);
          W && (W.liveStyle = !1);
        } else
          D.protectedKeys[T] = !0;
        D.out[T] = it;
      }
      if (D.prevProp = st, D.prevResolvedValues = nt, D.prevOut = L, D.isActive && (M = { ...M, ...nt }), F && (!(xt && St) || rt))
        for (const T of ut) {
          const U = { type: et };
          if (typeof T == "string" && S && v && (g != null && g.enteringChildren)) {
            const k = (tt = ($ = Sa(g, T)) == null ? void 0 : $.transition) == null ? void 0 : tt.delayChildren;
            U.delay = b1(g.enteringChildren, i, k);
          }
          E.push({ animation: T, options: U });
        }
    }), w.size) {
      const et = {}, z = A();
      let D = z == null ? void 0 : z.transition;
      w.forEach((at, lt) => {
        at && (D = {
          ...D || i.getDefaultTransition(),
          [lt]: at
        });
        const st = i.getValue(lt);
        st && (st.liveStyle = !0);
        const dt = z && !Array.isArray(y) ? z[lt] : void 0, vt = i.getBaseTargetFromProps(p, lt);
        et[lt] = (dt !== void 0 ? dt : vt !== void 0 && !me(vt) ? vt : i.initialValues[lt] === void 0 ? i.baseTarget[lt] : void 0) ?? null;
      }), D && (et.transition = D), E.push({ animation: et });
    }
    const X = S && i.blockInitialAnimation || o && !v && (p.initial === !1 || p.initial === p.animate);
    return o = c = !1, !X && E.length ? a(E) : Promise.resolve();
  }
  function f(h, p) {
    var v;
    if (s[h].isActive === p)
      return Promise.resolve();
    (v = i.variantChildren) == null || v.forEach((y) => {
      var S;
      return (S = y.animationState) == null ? void 0 : S.setActive(h, p);
    }), s[h].isActive = p;
    const g = d(h);
    for (const y in s)
      s[y].protectedKeys = {};
    return g;
  }
  return {
    animateChanges: d,
    setActive: f,
    /**
     * Allows tests to inject a mocked animate function.
     * @internal
     */
    setAnimateFunction: (h) => {
      a = h(i);
    },
    getState: () => s,
    reset: () => {
      s = cb(), c = !0;
    }
  };
}
function ZC(i, a) {
  return typeof a == "string" ? a !== i : Array.isArray(a) ? !lS(a, i) : !1;
}
function cb() {
  const i = {};
  for (const a of yu)
    i[a] = {
      isActive: a === "animate",
      protectedKeys: {},
      needsAnimating: {},
      prevResolvedValues: {},
      out: {}
    };
  return i;
}
const kh = /* @__PURE__ */ q.createContext({
  transformPagePoint: (i) => i,
  isStatic: !1,
  reducedMotion: "never"
});
function KC(i = !0) {
  const a = q.useContext(mh);
  if (a === null)
    return [!0, null];
  const { isPresent: s, onExitComplete: o, register: c } = a, d = q.useId();
  q.useEffect(() => {
    if (i)
      return c(d);
  }, [i]);
  const f = q.useCallback(() => i && o && o(d), [d, o, i]);
  return !s && o ? [!1, f] : [!0];
}
const sS = /* @__PURE__ */ q.createContext({
  strict: !1
}), fb = {
  animation: ["variants", ...yu],
  exit: ["exit"],
  drag: ["drag", "dragControls"],
  focus: ["whileFocus"],
  hover: ["whileHover", "onHoverStart", "onHoverEnd"],
  tap: ["whileTap", "onTap", "onTapStart", "onTapCancel"],
  pan: ["onPan", "onPanStart", "onPanSessionStart", "onPanEnd"],
  inView: ["whileInView", "onViewportEnter", "onViewportLeave"],
  layout: ["layout", "layoutId"]
};
let db = !1;
function kC() {
  if (db)
    return;
  const i = {};
  for (const a in fb)
    i[a] = {
      isEnabled: (s) => fb[a].some((o) => !!s[o])
    };
  k1(i), db = !0;
}
function oS() {
  return kC(), iC();
}
function PC(i) {
  const a = oS();
  for (const s in i)
    a[s] = {
      ...a[s],
      ...i[s]
    };
  k1(a);
}
const bu = /* @__PURE__ */ q.createContext({});
function JC(i, a) {
  if (vu(i)) {
    const { initial: s, animate: o } = i;
    return {
      initial: s === !1 || Fs(s) ? s : void 0,
      animate: Fs(o) ? o : void 0
    };
  }
  return i.inherit !== !1 ? a : {};
}
function FC(i) {
  const { initial: a, animate: s } = JC(i, q.useContext(bu));
  return q.useMemo(() => ({ initial: a, animate: s }), [hb(a), hb(s)]);
}
function hb(i) {
  return Array.isArray(i) ? i.join(" ") : i;
}
const Ph = () => ({
  style: {},
  transform: {},
  transformOrigin: {},
  vars: {}
});
function rS(i, a, s) {
  for (const o in a)
    !me(a[o]) && !F1(o, s) && (i[o] = a[o]);
}
function IC({ transformTemplate: i }, a) {
  return q.useMemo(() => {
    const s = Ph();
    return qh(s, a, i), Object.assign({}, s.vars, s.style);
  }, [a]);
}
function WC(i, a) {
  const s = i.style || {}, o = {};
  return rS(o, s, i), Object.assign(o, IC(i, a)), o;
}
function $C(i, a) {
  const s = {}, o = WC(i, a);
  return i.drag && i.dragListener !== !1 && (s.draggable = !1, o.userSelect = o.WebkitUserSelect = o.WebkitTouchCallout = "none", o.touchAction = i.drag === !0 ? "none" : `pan-${i.drag === "x" ? "y" : "x"}`), i.tabIndex === void 0 && (i.onTap || i.onTapStart || i.whileTap) && (s.tabIndex = 0), s.style = o, s;
}
const uS = () => ({
  ...Ph(),
  attrs: {}
});
function tD(i, a, s, o) {
  const c = q.useMemo(() => {
    const d = uS();
    return O1(d, a, iS(o), i.transformTemplate, i.style), {
      ...d.attrs,
      style: { ...d.style }
    };
  }, [a]);
  if (i.style) {
    const d = {};
    return rS(d, i.style, i), { ...c, style: { ...d, ...c.style } };
  }
  return c;
}
const eD = /* @__PURE__ */ new Set([
  "animate",
  "exit",
  "variants",
  "initial",
  "style",
  "values",
  "transition",
  "transformTemplate",
  "custom",
  "inherit",
  "onBeforeLayoutMeasure",
  "onAnimationStart",
  "onAnimationComplete",
  "onUpdate",
  "onDragStart",
  "onDrag",
  "onDragEnd",
  "onMeasureDragConstraints",
  "onDirectionLock",
  "onDragTransitionEnd",
  "_dragX",
  "_dragY",
  "onHoverStart",
  "onHoverEnd",
  "onViewportEnter",
  "onViewportLeave",
  "globalTapTarget",
  "tap",
  "propagate",
  "ignoreStrict",
  "viewport",
  "pinch"
]);
function ru(i) {
  return i.startsWith("while") || i.startsWith("drag") && i !== "draggable" || i.startsWith("layout") || i.startsWith("onTap") || i.startsWith("onPan") || i.startsWith("onLayout") || eD.has(i);
}
function nD(i, a) {
  return i.startsWith("on") ? !ru(i) : (a == null ? void 0 : a(i)) ?? !ru(i);
}
function iD(i, a, s, o) {
  const c = {};
  for (const d in i)
    if (!(d === "values" && typeof i.values == "object") && !me(i[d])) {
      if (d === "fx") {
        i.fx && (c.fx = "");
        continue;
      }
      (nD(d, o) || s === !0 && ru(d) || !a && !ru(d) || // If trying to use native HTML drag events, forward drag listeners
      i.draggable && d.startsWith("onDrag")) && (c[d] = i[d]);
    }
  return c;
}
const aD = [
  "animate",
  "circle",
  "defs",
  "desc",
  "ellipse",
  "g",
  "image",
  "line",
  "filter",
  "marker",
  "mask",
  "metadata",
  "path",
  "pattern",
  "polygon",
  "polyline",
  "rect",
  "stop",
  "switch",
  "symbol",
  "svg",
  "text",
  "tspan",
  "use",
  "view"
];
function Jh(i) {
  return (
    /**
     * If it's not a string, it's a custom React component. Currently we only support
     * HTML custom React components.
     */
    typeof i != "string" || /**
     * If it contains a dash, the element is a custom HTML webcomponent.
     */
    i.includes("-") ? !1 : (
      /**
       * If it's in our list of lowercase SVG tags, it's an SVG component
       */
      !!(aD.indexOf(i) > -1 || /**
       * If it contains a capital letter, it's an SVG component
       */
      /[A-Z]/u.test(i))
    )
  );
}
function lD(i, a, s, { latestValues: o }, c, d = !1, f, h) {
  const g = (f ?? Jh(i) ? tD : $C)(a, o, c, i), v = iD(a, typeof i == "string", d, h), y = i !== q.Fragment ? { ...v, ...g, ref: s } : {}, { children: S } = a, E = q.useMemo(() => me(S) ? S.get() : S, [S]);
  return q.createElement(i, {
    ...y,
    children: E
  });
}
function sD({ scrapeMotionValuesFromProps: i, createRenderState: a }, s, o, c) {
  return {
    latestValues: oD(s, o, c, i),
    renderState: a()
  };
}
function oD(i, a, s, o) {
  const c = {}, d = o(i, {});
  for (const S in d)
    c[S] = Gr(d[S]);
  let { initial: f, animate: h } = i;
  const p = vu(i), g = Z1(i);
  a && g && !p && i.inherit !== !1 && (f === void 0 && (f = a.initial), h === void 0 && (h = a.animate));
  let v = s ? s.initial === !1 : !1;
  v = v || f === !1;
  const y = v ? h : f;
  if (y && typeof y != "boolean" && !gu(y)) {
    const S = Array.isArray(y) ? y : [y];
    for (let E = 0; E < S.length; E++) {
      const A = T1(i, S[E]);
      if (A) {
        const { transitionEnd: w, transition: M, ...C } = A;
        for (const N in C) {
          let H = C[N];
          if (Array.isArray(H)) {
            const X = v ? H.length - 1 : 0;
            H = H[X];
          }
          H !== null && (c[N] = H);
        }
        for (const N in w)
          c[N] = w[N];
      }
    }
  }
  return c;
}
const cS = (i) => (a, s) => {
  const o = q.useContext(bu), c = q.useContext(mh), d = () => sD(i, a, o, c);
  return s ? d() : hh(d);
}, rD = /* @__PURE__ */ cS({
  scrapeMotionValuesFromProps: Zh,
  createRenderState: Ph
}), uD = /* @__PURE__ */ cS({
  scrapeMotionValuesFromProps: aS,
  createRenderState: uS
}), cD = /* @__PURE__ */ Symbol.for("motionComponentSymbol");
function fD(i, a, s) {
  const o = q.useRef(s);
  q.useInsertionEffect(() => {
    o.current = s;
  });
  const c = q.useRef(null);
  return q.useCallback((d) => {
    var h;
    d && ((h = i.onMount) == null || h.call(i, d)), a && (d ? a.mount(d) : a.unmount());
    const f = o.current;
    if (typeof f == "function")
      if (d) {
        const p = f(d);
        typeof p == "function" && (c.current = p);
      } else c.current ? (c.current(), c.current = null) : f(d);
    else f && (f.current = d);
  }, [a]);
}
const fS = /* @__PURE__ */ q.createContext({});
function dD(i, a, s, o, c, d) {
  var N, H;
  const { visualElement: f } = q.useContext(bu), h = q.useContext(sS), p = q.useContext(mh), g = q.useContext(kh), v = g.reducedMotion, y = g.skipAnimations, S = q.useRef(null), E = q.useRef(!1);
  o = o || h.renderer, !S.current && o && (S.current = o(i, {
    visualState: a,
    parent: f,
    props: s,
    presenceContext: p,
    blockInitialAnimation: p ? p.initial === !1 : !1,
    reducedMotionConfig: v,
    skipAnimations: y,
    isSVG: d
  }), E.current && S.current && (S.current.manuallyAnimateOnMount = !0));
  const A = S.current, w = q.useContext(fS);
  A && !A.projection && c && (A.type === "html" || A.type === "svg") && c.create(A, s, w), q.useInsertionEffect(() => {
    A && A.props !== s && A.update(s, p);
  });
  const M = s[x1], C = q.useRef(!!M && typeof window < "u" && !((N = window.MotionHandoffIsComplete) != null && N.call(window, M)) && ((H = window.MotionHasOptimisedAnimation) == null ? void 0 : H.call(window, M)));
  return Rd(() => {
    var X;
    !E.current || !A || ((X = A.animationState) == null || X.animateChanges(), A.enteringChildren = void 0);
  }, []), Rd(() => {
    E.current = !0, A && (window.MotionIsMounted = !0, A.updateFeatures(), A.scheduleRenderMicrotask(), C.current && A.animationState && A.animationState.animateChanges());
  }), q.useEffect(() => {
    A && (!C.current && A.animationState && A.animationState.animateChanges(), C.current && (queueMicrotask(() => {
      var X;
      (X = window.MotionHandoffMarkAsComplete) == null || X.call(window, M);
    }), C.current = !1), A.enteringChildren = void 0);
  }), A;
}
function Ed(i, { forwardMotionProps: a = !1, type: s } = {}, o, c) {
  o && PC(o);
  const d = s ? s === "svg" : Jh(i), f = d ? uD : rD;
  function h(g, v) {
    var N, H;
    let y;
    const S = hD(g);
    hh(() => {
      var X, I;
      return !!((I = (X = qr.current) == null ? void 0 : X.sharedNodes.get(S)) != null && I.lead) && g.initial;
    }) && (g = { ...g, initial: !1 });
    const E = {
      ...q.useContext(kh),
      ...g,
      layoutId: S
    }, { isStatic: A, isValidProp: w } = E, M = FC(g), C = f(g, A);
    if (!A && typeof window < "u") {
      mD();
      const X = pD(E);
      M.visualElement = dD(i, C, E, c, X.ProjectionNode, d), (X.isEnabled || (H = (N = M.visualElement) == null ? void 0 : N.projection) != null && H.options.layoutId) && (y = X.MeasureLayout);
    }
    return kr.jsxs(bu.Provider, { value: M, children: [y && M.visualElement ? kr.jsx(y, { visualElement: M.visualElement, ...E }) : null, lD(i, g, fD(C, M.visualElement, v), C, A, a, d, w)] });
  }
  h.displayName = `motion.${typeof i == "string" ? i : `create(${i.displayName ?? i.name ?? ""})`}`;
  const p = q.forwardRef(h);
  return p[cD] = i, p;
}
function hD({ layoutId: i }) {
  const a = q.useContext(zb).id;
  return a && i !== void 0 ? a + "-" + i : i;
}
function mD(i, a) {
  q.useContext(sS).strict;
}
function pD(i) {
  const a = oS(), { drag: s, layout: o } = a;
  if (!s && !o)
    return {};
  const c = { ...s, ...o };
  return {
    MeasureLayout: c.MeasureLayout,
    isEnabled: (s == null ? void 0 : s.isEnabled(i)) || (o == null ? void 0 : o.isEnabled(i)),
    ProjectionNode: c.ProjectionNode
  };
}
function gD(i, a) {
  if (typeof Proxy > "u")
    return Ed;
  const s = /* @__PURE__ */ new Map(), o = (d, f) => Ed(d, f, i, a), c = (d, f) => o(d, f);
  return new Proxy(c, {
    /**
     * Called when `motion` is referenced with a prop: `motion.div`, `motion.input` etc.
     * The prop name is passed through as `key` and we can use that to generate a `motion`
     * DOM component with that name.
     */
    get: (d, f) => f === "create" ? o : (s.has(f) || s.set(f, Ed(f, void 0, i, a)), s.get(f))
  });
}
const yD = (i, a) => a.isSVG ?? Jh(i) ? new qC(a) : new sC(a, {
  allowProjection: i !== q.Fragment
});
class vD extends Yi {
  /**
   * We dynamically generate the AnimationState manager as it contains a reference
   * to the underlying animation library. We only want to load that if we load this,
   * so people can optionally code split it out using the `m` component.
   */
  constructor(a) {
    super(a), a.animationState || (a.animationState = QC(a));
  }
  updateAnimationControlsSubscription() {
    const { animate: a } = this.node.getProps();
    gu(a) && (this.unmountControls = a.subscribe(this.node));
  }
  /**
   * Subscribe any provided AnimationControls to the component's VisualElement
   */
  mount() {
    this.updateAnimationControlsSubscription();
  }
  update() {
    var a;
    this.node.getProps().animate !== ((a = this.node.prevProps) == null ? void 0 : a.animate) && this.updateAnimationControlsSubscription();
  }
  unmount() {
    var a;
    this.node.animationState.reset(), (a = this.unmountControls) == null || a.call(this);
  }
}
let bD = 0;
class SD extends Yi {
  constructor() {
    super(...arguments), this.id = bD++;
  }
  update() {
    var f;
    const { presenceContext: a, animationState: s } = this.node;
    if (!a || !s)
      return;
    const { isPresent: o, onExitComplete: c } = a;
    if (o === !this.exit)
      return;
    if (o) {
      if (this.exit === !0) {
        const { initial: h } = this.node.getProps();
        if (h && !Array.isArray(h)) {
          const { transition: p, transitionEnd: g, ...v } = Sa(this.node, h) || {};
          for (const y in v)
            (f = this.node.getValue(y)) == null || f.jump(v[y]);
        }
        this.node.blockInitialAnimation = !1, s.reset(), s.animateChanges();
      } else
        s.setActive("exit", !1);
      this.exit = void 0;
      return;
    }
    const d = this.exit = s.setActive("exit", !0);
    c && d.then(() => {
      this.exit === d && (this.exit = !0, c(this.id));
    });
  }
  mount() {
    const { register: a } = this.node.presenceContext || {};
    a && (this.unmount = a(this.id, this.node)), this.update();
  }
  unmount() {
  }
}
const TD = {
  animation: {
    Feature: vD
  },
  exit: {
    Feature: SD
  }
};
class ED extends Yi {
  constructor(a) {
    super(a), this.removeGroupControls = xn, this.removeListeners = xn, this.controls = new RC(a);
  }
  mount() {
    const { dragControls: a } = this.node.getProps();
    a && (this.removeGroupControls = a.subscribe(this.controls)), this.removeListeners = this.controls.addListeners() || xn;
  }
  update() {
    const { dragControls: a, drag: s } = this.node.getProps(), { dragControls: o, drag: c } = this.node.prevProps || {};
    a !== o && (this.removeGroupControls(), a && (this.removeGroupControls = a.subscribe(this.controls))), c && !s && this.controls.stop(void 0, void 0, c);
  }
  unmount() {
    this.removeGroupControls(), this.removeListeners(), this.controls.isDragging || this.controls.endPanSession();
  }
}
const Ad = (i) => (a, s) => {
  i && qt.update(() => i(a, s), !1, !0);
};
class AD extends Yi {
  constructor() {
    super(...arguments), this.removePointerDownListener = xn;
  }
  onPointerDown(a) {
    var s;
    this.session = new W1(a, this.createPanHandlers(), {
      transformPagePoint: this.node.getTransformPagePoint(),
      // Fixes https://github.com/motiondivision/motion/issues/2270
      contextWindow: (s = this.node.current) == null ? void 0 : s.ownerDocument.defaultView
    });
  }
  createPanHandlers() {
    const { onPanSessionStart: a, onPanStart: s, onPan: o, onPanEnd: c } = this.node.getProps();
    return {
      onSessionStart: Ad(a),
      onStart: Ad(s),
      onMove: Ad(o),
      onEnd: (d, f) => {
        delete this.session, c && qt.postRender(() => c(d, f));
      }
    };
  }
  mount() {
    this.removePointerDownListener = Gs(this.node.current, "pointerdown", (a) => this.onPointerDown(a));
  }
  update() {
    var a;
    (a = this.session) == null || a.updateHandlers(this.createPanHandlers());
  }
  unmount() {
    var a;
    this.removePointerDownListener(), (a = this.session) == null || a.end();
  }
}
let xd = !1;
const mb = ({ layout: i, layoutDependency: a, layoutAnchor: s }) => ({
  layout: i,
  layoutDependency: a,
  layoutAnchor: s,
  animationType: typeof i == "string" ? i : "both"
}), pb = (i, a) => {
  const { snapshot: s } = i, o = i.getStack();
  o == null || o.remove(i);
  const c = o == null ? void 0 : o.lead;
  if ((o == null ? void 0 : o.prevLead) === i && c.resumeFrom === i && (c.resumeFrom = c.currentAnimation = i.resumingFrom = void 0), i.options.layoutId = a, !a) {
    i.needsShow = !0;
    return;
  }
  return i.root.registerSharedNode(a, i), () => {
    const { resumeFrom: d } = i;
    (d == null ? void 0 : d.isPresent) !== !1 && i.getStack().members.includes(d) && (d.hide(), i.resumeFrom = void 0, i.snapshot = s);
  };
};
class xD extends q.Component {
  /**
   * This only mounts projection nodes for components that
   * need measuring, we might want to do it for all components
   * in order to incorporate transforms
   */
  componentDidMount() {
    var f, h, p;
    const { visualElement: a, layoutGroup: s, switchLayoutGroup: o, layoutId: c } = this.props, { projection: d } = a;
    d && ((f = s.group) == null || f.add(d), c && ((h = o == null ? void 0 : o.register) == null || h.call(o, d)), xd && d.root.didUpdate(), d.options.layoutId !== c && ((p = pb(d, c)) == null || p()), d.addEventListener("animationComplete", () => this.safeToRemove()), d.setOptions({
      ...d.options,
      ...mb(this.props),
      onExitComplete: () => this.safeToRemove()
    })), Yr.hasEverUpdated = !0;
  }
  getSnapshotBeforeUpdate(a) {
    const { layoutDependency: s, layoutId: o, visualElement: c, drag: d, isPresent: f } = this.props, { projection: h } = c;
    return h && (h.isPresent = f, this.takeOver = a.layoutId !== o ? (h.willUpdate(), pb(h, o)) : void 0, h.setOptions({
      ...h.options,
      ...mb(this.props)
    }), xd = !0, d || a.layoutDependency !== s || s === void 0 || a.isPresent !== f ? h.willUpdate() : this.safeToRemove(), a.isPresent !== f && (f ? h.promote() : h.relegate() || qt.postRender(() => {
      var p;
      (p = h.getStack()) != null && p.members.length || this.safeToRemove();
    }))), null;
  }
  componentDidUpdate() {
    var s;
    const { projection: a } = this.props.visualElement;
    a && ((s = this.takeOver) == null || s.call(this), a.root.didUpdate(), Xh.postRender(() => {
      !a.currentAnimation && a.isLead() && this.safeToRemove();
    }));
  }
  componentWillUnmount() {
    var d, f;
    const { visualElement: a, layoutGroup: s, switchLayoutGroup: o } = this.props, { projection: c } = a;
    xd = !0, c && (c.scheduleCheckAfterUnmount(), (d = s.group) == null || d.remove(c), (f = o == null ? void 0 : o.deregister) == null || f.call(o, c));
  }
  safeToRemove() {
    var a, s;
    (s = (a = this.props).safeToRemove) == null || s.call(a);
  }
  render() {
    return null;
  }
}
function dS(i) {
  const [a, s] = KC(), o = q.useContext(zb);
  return kr.jsx(xD, { ...i, layoutGroup: o, switchLayoutGroup: q.useContext(fS), isPresent: a, safeToRemove: s });
}
const MD = {
  pan: {
    Feature: AD
  },
  drag: {
    Feature: ED,
    ProjectionNode: Q1,
    MeasureLayout: dS
  }
};
function nh(i, a, s, o, c) {
  const { props: d } = i, f = "while" + s;
  !c && i.animationState && d[f] && i.animationState.setActive(f, o === "Start");
  const h = d["on" + s + o];
  h && qt.postRender(() => h(a, Kh(a)));
}
class wD extends Yi {
  mount() {
    const { current: a } = this.node;
    a && (this.unmount = LC(a, (s, o) => (nh(this.node, o, "Hover", "Start"), (c) => nh(this.node, c, "Hover", "End"))));
  }
  unmount() {
  }
}
class CD extends Yi {
  constructor() {
    super(...arguments), this.isActive = !1;
  }
  onFocus() {
    let a = !1;
    try {
      a = this.node.current.matches(":focus-visible");
    } catch {
      a = !0;
    }
    !a || !this.node.animationState || (this.node.animationState.setActive("whileFocus", !0), this.isActive = !0);
  }
  onBlur() {
    !this.isActive || !this.node.animationState || (this.node.animationState.setActive("whileFocus", !1), this.isActive = !1);
  }
  mount() {
    this.unmount = Ml(xa(this.node.current, "focus", () => this.onFocus()), xa(this.node.current, "blur", () => this.onBlur()));
  }
  unmount() {
  }
}
function Md(i, a, s, o) {
  i.current instanceof HTMLButtonElement && i.current.disabled || nh(i, a, "Tap", s, o);
}
class DD extends Yi {
  constructor() {
    super(...arguments), this.options = {};
  }
  mount() {
    const { current: a } = this.node;
    a && (this.update(), this.unmount = GC(a, (s, o) => (Md(this.node, o, "Start"), {
      onComplete: (c, { success: d }) => Md(this.node, c, d ? "" : "Cancel"),
      onRepeat: () => Md(this.node, o, "", !0)
    }), this.options));
  }
  update() {
    const { options: a, node: s } = this, { globalTapTarget: o, propagate: c, tap: d } = s.props;
    for (const f in a)
      delete a[f];
    Object.assign(a, d, {
      useGlobalTarget: o,
      stopPropagation: (c == null ? void 0 : c.tap) === !1
    });
  }
  unmount() {
  }
}
const ih = /* @__PURE__ */ new WeakMap(), wd = /* @__PURE__ */ new WeakMap(), OD = (i) => {
  const a = ih.get(i.target);
  a && a(i);
}, zD = (i) => {
  i.forEach(OD);
};
function RD({ root: i, ...a }) {
  const s = i || document;
  wd.has(s) || wd.set(s, {});
  const o = wd.get(s), c = JSON.stringify(a);
  return o[c] || (o[c] = new IntersectionObserver(zD, { root: i, ...a })), o[c];
}
function ND(i, a, s) {
  const o = RD(a);
  return ih.set(i, s), o.observe(i), () => {
    ih.delete(i), o.unobserve(i);
  };
}
const _D = {
  some: 0,
  all: 1
};
class VD extends Yi {
  constructor() {
    super(...arguments), this.hasEnteredView = !1, this.isInView = !1;
  }
  startObserver() {
    var p;
    (p = this.stopObserver) == null || p.call(this);
    const { viewport: a = {} } = this.node.getProps(), { root: s, margin: o, amount: c = "some", once: d } = a, f = {
      root: s ? s.current : void 0,
      rootMargin: o,
      threshold: typeof c == "number" ? c : _D[c]
    }, h = (g) => {
      const { isIntersecting: v } = g;
      if (this.isInView === v || (this.isInView = v, d && !v && this.hasEnteredView))
        return;
      v && (this.hasEnteredView = !0), this.node.animationState && this.node.animationState.setActive("whileInView", v);
      const { onViewportEnter: y, onViewportLeave: S } = this.node.getProps(), E = v ? y : S;
      E && E(g);
    };
    this.stopObserver = ND(this.node.current, f, h);
  }
  mount() {
    this.startObserver();
  }
  update() {
    if (typeof IntersectionObserver > "u")
      return;
    const { props: a, prevProps: s } = this.node;
    ["amount", "margin", "root"].some(LD(a, s)) && this.startObserver();
  }
  unmount() {
    var a;
    (a = this.stopObserver) == null || a.call(this), this.hasEnteredView = !1, this.isInView = !1;
  }
}
function LD({ viewport: i = {} }, { viewport: a = {} } = {}) {
  return (s) => i[s] !== a[s];
}
const UD = {
  inView: {
    Feature: VD
  },
  tap: {
    Feature: DD
  },
  focus: {
    Feature: CD
  },
  hover: {
    Feature: wD
  }
}, BD = {
  layout: {
    ProjectionNode: Q1,
    MeasureLayout: dS
  }
}, HD = /* @__PURE__ */ Object.assign({}, TD, UD, MD, BD), jD = /* @__PURE__ */ gD(HD, yD);
function ah(i) {
  const a = hh(() => Aa(i)), { isStatic: s } = q.useContext(kh);
  if (s) {
    const [, o] = q.useState(i);
    q.useEffect(() => a.on("change", o), []);
  }
  return a;
}
function GD(i, a) {
  const s = ah(a()), o = () => s.set(a());
  return o(), Rd(() => {
    const c = () => qt.preRender(o, !1, !0), d = i.map((f) => f.on("change", c));
    return o(), () => {
      d.forEach((f) => f()), Ye(o);
    };
  }), s;
}
function YD(i, ...a) {
  const s = i.length;
  function o() {
    let c = "";
    for (let d = 0; d < s; d++) {
      c += i[d];
      const f = a[d];
      f && (c += me(f) ? f.get() : f);
    }
    return c;
  }
  return GD(a.filter(me), o);
}
function Fh() {
  !Qh.current && K1();
  const [i] = q.useState(lu.current);
  return i;
}
const qD = {
  some: 0,
  all: 1
};
function XD(i, a, { root: s, margin: o, amount: c = "some" } = {}) {
  const d = Yh(i);
  a = pu(a);
  const f = /* @__PURE__ */ new WeakMap(), h = (g) => {
    g.forEach((v) => {
      const y = f.get(v.target);
      if (v.isIntersecting !== !!y)
        if (v.isIntersecting) {
          const S = a(v.target, v);
          typeof S == "function" ? f.set(v.target, S) : p.unobserve(v.target);
        } else typeof y == "function" && (y(v), f.delete(v.target));
    });
  }, p = new IntersectionObserver(h, {
    root: s,
    rootMargin: o,
    threshold: typeof c == "number" ? c : qD[c]
  });
  return d.forEach((g) => p.observe(g)), mu(() => p.disconnect());
}
function QD(i, { root: a, margin: s, amount: o, once: c = !1, initial: d = !1 } = {}) {
  const [f, h] = q.useState(d), [p, g] = q.useState({});
  return q.useEffect(() => {
    const v = p.current = i.current;
    if (!v || c && f)
      return;
    const y = () => (h(!0), c ? void 0 : () => h(!1)), S = {
      root: a && a.current || void 0,
      margin: s,
      amount: o
    };
    return XD(v, y, S);
  }, [a, i, s, c, o, p]), q.useEffect(() => {
    i.current !== p.current && (c || h(!1), g({}));
  }), f;
}
const Ih = jD, gb = (i, a, s, o) => {
  i.style.transition = `${a} ${s}ms ${o}`;
}, li = (i, a, s) => Math.min(Math.max(i, a), s);
class ZD {
  constructor(a, s) {
    zt(this, "glareWrapperEl");
    zt(this, "glareEl");
    zt(this, "glareAngle", 0);
    zt(this, "glareOpacity", 0);
    zt(this, "calculateGlareSize", (a) => {
      const { width: s, height: o } = a, c = Math.sqrt(s ** 2 + o ** 2);
      return { width: c, height: c };
    });
    zt(this, "setSize", (a) => {
      const s = this.calculateGlareSize(a);
      this.glareEl.style.width = `${s.width}px`, this.glareEl.style.height = `${s.height}px`;
    });
    zt(this, "update", (a, s, o, c) => {
      this.updateAngle(a, s.glareReverse), this.updateOpacity(a, s, o, c);
    });
    zt(this, "updateAngle", (a, s) => {
      const { xPercentage: o, yPercentage: c } = a, d = 180 / Math.PI, f = o ? Math.atan2(c, -o) * d : 0;
      this.glareAngle = f - (s ? 180 : 0);
    });
    zt(this, "updateOpacity", (a, s, o, c) => {
      const { xPercentage: d, yPercentage: f } = a, { glarePosition: h, glareReverse: p, glareMaxOpacity: g } = s, v = o ? -1 : 1, y = c ? -1 : 1, S = p ? -1 : 1;
      let E = 0;
      switch (h) {
        case "top":
          E = -d * v * S;
          break;
        case "right":
          E = f * y * S;
          break;
        case "bottom":
        case void 0:
          E = d * v * S;
          break;
        case "left":
          E = -f * y * S;
          break;
        case "all":
          E = Math.hypot(d, f);
      }
      const A = li(E, 0, 100);
      this.glareOpacity = A * g / 100;
    });
    zt(this, "render", (a) => {
      const { glareColor: s } = a;
      this.glareEl.style.transform = `rotate(${this.glareAngle}deg) translate(-50%, -50%)`, this.glareEl.style.opacity = this.glareOpacity.toString(), this.glareEl.style.background = `linear-gradient(0deg, rgba(255,255,255,0) 0%, ${s} 100%)`;
    });
    this.glareWrapperEl = document.createElement("div"), this.glareEl = document.createElement("div"), this.glareWrapperEl.appendChild(this.glareEl), this.glareWrapperEl.className = "glare-wrapper", this.glareEl.className = "glare";
    const o = { position: "absolute", top: "0", left: "0", width: "100%", height: "100%", overflow: "hidden", borderRadius: s, WebkitMaskImage: "-webkit-radial-gradient(white, black)", pointerEvents: "none" }, c = this.calculateGlareSize(a), d = { position: "absolute", top: "50%", left: "50%", transformOrigin: "0% 0%", pointerEvents: "none", width: `${c.width}px`, height: `${c.height}px` };
    Object.assign(this.glareWrapperEl.style, o), Object.assign(this.glareEl.style, d);
  }
}
let KD = class {
  constructor() {
    zt(this, "tiltAngleX", 0);
    zt(this, "tiltAngleY", 0);
    zt(this, "tiltAngleXPercentage", 0);
    zt(this, "tiltAngleYPercentage", 0);
    zt(this, "update", (a, s) => {
      this.updateTilt(a, s), this.updateTiltManualInput(a, s), this.updateTiltReverse(s), this.updateTiltLimits(s);
    });
    zt(this, "updateTilt", (a, s) => {
      const { xPercentage: o, yPercentage: c } = a, { tiltMaxAngleX: d, tiltMaxAngleY: f } = s;
      this.tiltAngleX = o * d / 100, this.tiltAngleY = c * f / 100 * -1;
    });
    zt(this, "updateTiltManualInput", (a, s) => {
      const { tiltAngleXManual: o, tiltAngleYManual: c, tiltMaxAngleX: d, tiltMaxAngleY: f } = s;
      (o !== null || c !== null) && (this.tiltAngleX = o !== null ? o : 0, this.tiltAngleY = c !== null ? c : 0, a.xPercentage = 100 * this.tiltAngleX / d, a.yPercentage = 100 * this.tiltAngleY / f);
    });
    zt(this, "updateTiltReverse", (a) => {
      const s = a.tiltReverse ? -1 : 1;
      this.tiltAngleX = s * this.tiltAngleX, this.tiltAngleY = s * this.tiltAngleY;
    });
    zt(this, "updateTiltLimits", (a) => {
      const { tiltAxis: s } = a;
      this.tiltAngleX = li(this.tiltAngleX, -90, 90), this.tiltAngleY = li(this.tiltAngleY, -90, 90), s && (this.tiltAngleX = s === "x" ? this.tiltAngleX : 0, this.tiltAngleY = s === "y" ? this.tiltAngleY : 0);
    });
    zt(this, "updateTiltAnglesPercentage", (a) => {
      const { tiltMaxAngleX: s, tiltMaxAngleY: o } = a;
      this.tiltAngleXPercentage = this.tiltAngleX / s * 100, this.tiltAngleYPercentage = this.tiltAngleY / o * 100;
    });
    zt(this, "render", (a) => {
      a.style.transform += `rotateX(${this.tiltAngleX}deg) rotateY(${this.tiltAngleY}deg) `;
    });
  }
};
const kD = { scale: 1, perspective: 1e3, flipVertically: !1, flipHorizontally: !1, reset: !0, transitionEasing: "cubic-bezier(.03,.98,.52,.99)", transitionSpeed: 400, trackOnWindow: !1, gyroscope: !1, tiltEnable: !0, tiltReverse: !1, tiltAngleXInitial: 0, tiltAngleYInitial: 0, tiltMaxAngleX: 20, tiltMaxAngleY: 20, tiltAxis: void 0, tiltAngleXManual: null, tiltAngleYManual: null, glareEnable: !1, glareMaxOpacity: 0.7, glareColor: "#ffffff", glarePosition: "bottom", glareReverse: !1, glareBorderRadius: "0" };
class hS extends q.PureComponent {
  constructor() {
    super(...arguments);
    zt(this, "wrapperEl", { node: null, size: { width: 0, height: 0, left: 0, top: 0 }, clientPosition: { x: null, y: null, xPercentage: 0, yPercentage: 0 }, updateAnimationId: null, scale: 1 });
    zt(this, "tilt", null);
    zt(this, "glare", null);
    zt(this, "addDeviceOrientationEventListener", async () => {
      if (!window.DeviceOrientationEvent) return;
      const s = DeviceOrientationEvent.requestPermission;
      if (typeof s == "function")
        return void (await s() === "granted" && window.addEventListener("deviceorientation", this.onMove));
      window.addEventListener("deviceorientation", this.onMove);
    });
    zt(this, "setSize", () => {
      this.setWrapperElSize(), this.glare && this.glare.setSize(this.wrapperEl.size);
    });
    zt(this, "mainLoop", (s) => {
      this.wrapperEl.updateAnimationId !== null && cancelAnimationFrame(this.wrapperEl.updateAnimationId), this.processInput(s), this.update(s.type), this.wrapperEl.updateAnimationId = requestAnimationFrame(this.renderFrame);
    });
    zt(this, "onEnter", (s) => {
      const { onEnter: o } = this.props;
      this.setSize(), this.wrapperEl.node.style.willChange = "transform", this.setTransitions(), o && o({ event: s });
    });
    zt(this, "onMove", (s) => {
      this.mainLoop(s), this.emitOnMove(s);
    });
    zt(this, "onLeave", (s) => {
      const { onLeave: o } = this.props;
      if (this.setTransitions(), o && o({ event: s }), this.props.reset) {
        const c = new CustomEvent("autoreset");
        this.onMove(c);
      }
    });
    zt(this, "processInput", (s) => {
      const { scale: o } = this.props;
      switch (s.type) {
        case "mousemove":
          this.wrapperEl.clientPosition.x = s.pageX, this.wrapperEl.clientPosition.y = s.pageY, this.wrapperEl.scale = o;
          break;
        case "touchmove":
          this.wrapperEl.clientPosition.x = s.touches[0].pageX, this.wrapperEl.clientPosition.y = s.touches[0].pageY, this.wrapperEl.scale = o;
          break;
        case "deviceorientation":
          this.processInputDeviceOrientation(s), this.wrapperEl.scale = o;
          break;
        case "autoreset": {
          const { tiltAngleXInitial: c, tiltAngleYInitial: d, tiltMaxAngleX: f, tiltMaxAngleY: h } = this.props, p = d / h * 100;
          this.wrapperEl.clientPosition.xPercentage = li(c / f * 100, -100, 100), this.wrapperEl.clientPosition.yPercentage = li(p, -100, 100), this.wrapperEl.scale = 1;
          break;
        }
      }
    });
    zt(this, "processInputDeviceOrientation", (s) => {
      if (!s.gamma || !s.beta || !this.props.gyroscope) return;
      const { tiltMaxAngleX: o, tiltMaxAngleY: c } = this.props, d = s.gamma;
      this.wrapperEl.clientPosition.xPercentage = s.beta / o * 100, this.wrapperEl.clientPosition.yPercentage = d / c * 100, this.wrapperEl.clientPosition.xPercentage = li(this.wrapperEl.clientPosition.xPercentage, -100, 100), this.wrapperEl.clientPosition.yPercentage = li(this.wrapperEl.clientPosition.yPercentage, -100, 100);
    });
    zt(this, "update", (s) => {
      const { tiltEnable: o, flipVertically: c, flipHorizontally: d } = this.props;
      s !== "autoreset" && s !== "deviceorientation" && s !== "propChange" && this.updateClientInput(), o && this.tilt.update(this.wrapperEl.clientPosition, this.props), this.updateFlip(), this.tilt.updateTiltAnglesPercentage(this.props), this.glare && this.glare.update(this.wrapperEl.clientPosition, this.props, c, d);
    });
    zt(this, "updateClientInput", () => {
      const { trackOnWindow: s } = this.props;
      let o, c;
      if (s) {
        const { x: d, y: f } = this.wrapperEl.clientPosition;
        o = f / window.innerHeight * 200 - 100, c = d / window.innerWidth * 200 - 100;
      } else {
        const { size: { width: d, height: f, left: h, top: p }, clientPosition: { x: g, y: v } } = this.wrapperEl;
        o = (v - p) / f * 200 - 100, c = (g - h) / d * 200 - 100;
      }
      this.wrapperEl.clientPosition.xPercentage = li(o, -100, 100), this.wrapperEl.clientPosition.yPercentage = li(c, -100, 100);
    });
    zt(this, "updateFlip", () => {
      const { flipVertically: s, flipHorizontally: o } = this.props;
      s && (this.tilt.tiltAngleX += 180, this.tilt.tiltAngleY *= -1), o && (this.tilt.tiltAngleY += 180);
    });
    zt(this, "renderFrame", () => {
      this.resetWrapperElTransform(), this.renderPerspective(), this.tilt.render(this.wrapperEl.node), this.renderScale(), this.glare && this.glare.render(this.props);
    });
  }
  componentDidMount() {
    if (this.tilt = new KD(), this.initGlare(), this.setSize(), this.addEventListeners(), typeof CustomEvent > "u") return;
    const s = new CustomEvent("autoreset");
    this.mainLoop(s);
    const o = new CustomEvent("initial");
    this.emitOnMove(o);
  }
  componentWillUnmount() {
    this.wrapperEl.updateAnimationId !== null && cancelAnimationFrame(this.wrapperEl.updateAnimationId), this.removeEventListeners();
  }
  componentDidUpdate() {
    const s = new CustomEvent("propChange");
    this.mainLoop(s), this.emitOnMove(s);
  }
  addEventListeners() {
    const { trackOnWindow: s, gyroscope: o } = this.props;
    window.addEventListener("resize", this.setSize), s && (window.addEventListener("mouseenter", this.onEnter), window.addEventListener("mousemove", this.onMove), window.addEventListener("mouseout", this.onLeave), window.addEventListener("touchstart", this.onEnter), window.addEventListener("touchmove", this.onMove), window.addEventListener("touchend", this.onLeave)), o && this.addDeviceOrientationEventListener();
  }
  removeEventListeners() {
    const { trackOnWindow: s, gyroscope: o } = this.props;
    window.removeEventListener("resize", this.setSize), s && (window.removeEventListener("mouseenter", this.onEnter), window.removeEventListener("mousemove", this.onMove), window.removeEventListener("mouseout", this.onLeave), window.removeEventListener("touchstart", this.onEnter), window.removeEventListener("touchmove", this.onMove), window.removeEventListener("touchend", this.onLeave)), o && window.DeviceOrientationEvent && window.removeEventListener("deviceorientation", this.onMove);
  }
  setWrapperElSize() {
    const s = this.wrapperEl.node.getBoundingClientRect();
    this.wrapperEl.size.width = this.wrapperEl.node.offsetWidth, this.wrapperEl.size.height = this.wrapperEl.node.offsetHeight, this.wrapperEl.size.left = s.left + window.scrollX, this.wrapperEl.size.top = s.top + window.scrollY;
  }
  initGlare() {
    const { glareEnable: s, glareBorderRadius: o } = this.props;
    s && (this.glare = new ZD(this.wrapperEl.size, o), this.wrapperEl.node.appendChild(this.glare.glareWrapperEl));
  }
  emitOnMove(s) {
    const { onMove: o } = this.props;
    if (!o) return;
    let c = 0, d = 0;
    this.glare && (c = this.glare.glareAngle, d = this.glare.glareOpacity), o({ tiltAngleX: this.tilt.tiltAngleX, tiltAngleY: this.tilt.tiltAngleY, tiltAngleXPercentage: this.tilt.tiltAngleXPercentage, tiltAngleYPercentage: this.tilt.tiltAngleYPercentage, glareAngle: c, glareOpacity: d, event: s });
  }
  resetWrapperElTransform() {
    this.wrapperEl.node.style.transform = "";
  }
  renderPerspective() {
    const { perspective: s } = this.props;
    this.wrapperEl.node.style.transform += `perspective(${s}px) `;
  }
  renderScale() {
    const { scale: s } = this.wrapperEl;
    this.wrapperEl.node.style.transform += `scale3d(${s},${s},${s})`;
  }
  setTransitions() {
    const { transitionSpeed: s, transitionEasing: o } = this.props;
    gb(this.wrapperEl.node, "all", s, o), this.glare && gb(this.glare.glareEl, "opacity", s, o);
  }
  render() {
    const { children: s, className: o, style: c } = this.props;
    return kr.jsx("div", { ref: (d) => {
      this.wrapperEl.node = d;
    }, onMouseEnter: this.onEnter, onMouseMove: this.onMove, onMouseLeave: this.onLeave, onTouchStart: this.onEnter, onTouchMove: this.onMove, onTouchEnd: this.onLeave, className: o, style: c, children: s });
  }
}
zt(hS, "defaultProps", kD);
var PD = Object.defineProperty, Wh = (i, a) => PD(i, "name", { value: a, configurable: !0 });
function lh(i, a) {
  if (typeof i == "function")
    return i(a);
  i != null && (i.current = a);
}
Wh(lh, "setRef");
function mS(...i) {
  return (a) => {
    let s = !1;
    const o = i.map((c) => {
      const d = lh(c, a);
      return !s && typeof d == "function" && (s = !0), d;
    });
    if (s)
      return () => {
        for (let c = 0; c < o.length; c++) {
          const d = o[c];
          typeof d == "function" ? d() : lh(i[c], null);
        }
      };
  };
}
Wh(mS, "composeRefs");
function pS(...i) {
  return q.useCallback(mS(...i), i);
}
Wh(pS, "useComposedRefs");
var JD = Object.defineProperty, tn = (i, a) => JD(i, "name", { value: a, configurable: !0 });
// @__NO_SIDE_EFFECTS__
function gS(i) {
  const a = q.forwardRef((s, o) => {
    let { children: c, ...d } = s, f = null, h = !1;
    const p = [];
    c = ES(c), q.Children.forEach(c, (S) => {
      var E;
      if (SS(S)) {
        h = !0;
        const A = S;
        let w = "child" in A.props ? A.props.child : A.props.children;
        for (; $h(w) && typeof uu == "function"; )
          w = uu(w._payload);
        f = WD(A, w), p.push((E = f == null ? void 0 : f.props) == null ? void 0 : E.children);
      } else
        p.push(S);
    }), f ? f = q.cloneElement(f, void 0, p) : (
      // A `Slottable` was found but it didn't resolve to a single element (e.g.
      // it wrapped multiple elements, text, or a render-prop `child` that
      // wasn't an element). Don't fall back to treating the `Slottable` wrapper
      // itself as the slot target — throw a descriptive error below instead.
      !h && q.Children.count(c) === 1 && q.isValidElement(c) && (f = c)
    );
    const g = f ? bS(f) : void 0, v = pS(o, g);
    if (!f) {
      if (c || c === 0)
        throw new Error(
          h ? eO(i) : tO(i)
        );
      return c;
    }
    const y = vS(d, f.props ?? {});
    return f.type !== q.Fragment && (y.ref = o ? v : g), q.cloneElement(f, y);
  });
  return a.displayName = `${i}.Slot`, a;
}
tn(gS, "createSlot");
var FD = /* @__PURE__ */ gS("Slot"), yS = Symbol.for("radix.slottable");
// @__NO_SIDE_EFFECTS__
function ID(i) {
  const a = /* @__PURE__ */ tn((s) => "child" in s ? s.children(s.child) : s.children, "Slottable");
  return a.displayName = `${i}.Slottable`, a.__radixId = yS, a;
}
tn(ID, "createSlottable");
var WD = /* @__PURE__ */ tn((i, a) => "child" in i.props ? q.isValidElement(a) ? q.cloneElement(a, void 0, i.props.children(a.props.children)) : null : q.isValidElement(a) ? a : null, "getSlottableElementFromSlottable");
function vS(i, a) {
  const s = { ...a };
  for (const o in a) {
    const c = i[o], d = a[o];
    /^on[A-Z]/.test(o) ? c && d ? s[o] = (...h) => {
      const p = d(...h);
      return c(...h), p;
    } : c && (s[o] = c) : o === "style" ? s[o] = { ...c, ...d } : o === "className" ? s[o] = [c, d].filter(Boolean).join(" ") : o === "aria-describedby" && (s[o] = AS(d, c));
  }
  return { ...i, ...s };
}
tn(vS, "mergeProps");
function bS(i) {
  var o, c;
  let a = (o = Object.getOwnPropertyDescriptor(i.props, "ref")) == null ? void 0 : o.get, s = a && "isReactWarning" in a && a.isReactWarning;
  return s ? i.ref : (a = (c = Object.getOwnPropertyDescriptor(i, "ref")) == null ? void 0 : c.get, s = a && "isReactWarning" in a && a.isReactWarning, s ? i.props.ref : i.props.ref || i.ref);
}
tn(bS, "getElementRef");
function SS(i) {
  return q.isValidElement(i) && typeof i.type == "function" && "__radixId" in i.type && i.type.__radixId === yS;
}
tn(SS, "isSlottable");
var $D = Symbol.for("react.lazy");
function $h(i) {
  return i != null && typeof i == "object" && "$$typeof" in i && i.$$typeof === $D && "_payload" in i && TS(i._payload);
}
tn($h, "isLazyComponent");
function TS(i) {
  return typeof i == "object" && i !== null && "then" in i;
}
tn(TS, "isPromiseLike");
function ES(i) {
  let a = i;
  for (; $h(a) && typeof uu == "function"; )
    a = uu(a._payload);
  return a;
}
tn(ES, "useUnwrappedLazy");
function AS(...i) {
  const a = /* @__PURE__ */ new Set();
  for (const s of i)
    if (typeof s == "string")
      for (const o of String(s).trim().split(/\s+/))
        o && a.add(o);
  return a.size > 0 ? Array.from(a).join(" ") : void 0;
}
tn(AS, "concatAriaDescribedby");
var tO = /* @__PURE__ */ tn((i) => `${i} failed to slot onto its children. Expected a single React element child or \`Slottable\`.`, "createSlotError"), eO = /* @__PURE__ */ tn((i) => `${i} failed to slot onto its \`Slottable\`. Expected \`Slottable\` to receive a single React element child.`, "createSlottableError"), uu = UA[" use ".trim().toString()];
function xS(i) {
  var a, s, o = "";
  if (typeof i == "string" || typeof i == "number") o += i;
  else if (typeof i == "object") if (Array.isArray(i)) {
    var c = i.length;
    for (a = 0; a < c; a++) i[a] && (s = xS(i[a])) && (o && (o += " "), o += s);
  } else for (s in i) i[s] && (o && (o += " "), o += s);
  return o;
}
function MS() {
  for (var i, a, s = 0, o = "", c = arguments.length; s < c; s++) (i = arguments[s]) && (a = xS(i)) && (o && (o += " "), o += a);
  return o;
}
const yb = (i) => typeof i == "boolean" ? `${i}` : i === 0 ? "0" : i, vb = MS, nO = (i, a) => (s) => {
  var o;
  if ((a == null ? void 0 : a.variants) == null) return vb(i, s == null ? void 0 : s.class, s == null ? void 0 : s.className);
  const { variants: c, defaultVariants: d } = a, f = Object.keys(c).map((g) => {
    const v = s == null ? void 0 : s[g], y = d == null ? void 0 : d[g];
    if (v === null) return null;
    const S = yb(v) || yb(y);
    return c[g][S];
  }), h = s && Object.entries(s).reduce((g, v) => {
    let [y, S] = v;
    return S === void 0 || (g[y] = S), g;
  }, {}), p = a == null || (o = a.compoundVariants) === null || o === void 0 ? void 0 : o.reduce((g, v) => {
    let { class: y, className: S, ...E } = v;
    return Object.entries(E).every((A) => {
      let [w, M] = A;
      return Array.isArray(M) ? M.includes({
        ...d,
        ...h
      }[w]) : {
        ...d,
        ...h
      }[w] === M;
    }) ? [
      ...g,
      y,
      S
    ] : g;
  }, []);
  return vb(i, f, p, s == null ? void 0 : s.class, s == null ? void 0 : s.className);
}, iO = (i, a) => {
  const s = new Array(i.length + a.length);
  for (let o = 0; o < i.length; o++)
    s[o] = i[o];
  for (let o = 0; o < a.length; o++)
    s[i.length + o] = a[o];
  return s;
}, aO = (i, a) => ({
  classGroupId: i,
  validator: a
}), wS = (i = /* @__PURE__ */ new Map(), a = null, s) => ({
  nextPart: i,
  validators: a,
  classGroupId: s
}), cu = "-", bb = [], lO = "arbitrary..", sO = (i) => {
  const a = rO(i), {
    conflictingClassGroups: s,
    conflictingClassGroupModifiers: o
  } = i;
  return {
    getClassGroupId: (f) => {
      if (f.startsWith("[") && f.endsWith("]"))
        return oO(f);
      const h = f.split(cu), p = h[0] === "" && h.length > 1 ? 1 : 0;
      return CS(h, p, a);
    },
    getConflictingClassGroupIds: (f, h) => {
      if (h) {
        const p = o[f], g = s[f];
        return p ? g ? iO(g, p) : p : g || bb;
      }
      return s[f] || bb;
    }
  };
}, CS = (i, a, s) => {
  if (i.length - a === 0)
    return s.classGroupId;
  const c = i[a], d = s.nextPart.get(c);
  if (d) {
    const g = CS(i, a + 1, d);
    if (g) return g;
  }
  const f = s.validators;
  if (f === null)
    return;
  const h = a === 0 ? i.join(cu) : i.slice(a).join(cu), p = f.length;
  for (let g = 0; g < p; g++) {
    const v = f[g];
    if (v.validator(h))
      return v.classGroupId;
  }
}, oO = (i) => i.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
  const a = i.slice(1, -1), s = a.indexOf(":"), o = a.slice(0, s);
  return o ? lO + o : void 0;
})(), rO = (i) => {
  const {
    theme: a,
    classGroups: s
  } = i;
  return uO(s, a);
}, uO = (i, a) => {
  const s = wS();
  for (const o in i) {
    const c = i[o];
    tm(c, s, o, a);
  }
  return s;
}, tm = (i, a, s, o) => {
  const c = i.length;
  for (let d = 0; d < c; d++) {
    const f = i[d];
    cO(f, a, s, o);
  }
}, cO = (i, a, s, o) => {
  if (typeof i == "string") {
    fO(i, a, s);
    return;
  }
  if (typeof i == "function") {
    dO(i, a, s, o);
    return;
  }
  hO(i, a, s, o);
}, fO = (i, a, s) => {
  const o = i === "" ? a : DS(a, i);
  o.classGroupId = s;
}, dO = (i, a, s, o) => {
  if (mO(i)) {
    tm(i(o), a, s, o);
    return;
  }
  a.validators === null && (a.validators = []), a.validators.push(aO(s, i));
}, hO = (i, a, s, o) => {
  const c = Object.entries(i), d = c.length;
  for (let f = 0; f < d; f++) {
    const [h, p] = c[f];
    tm(p, DS(a, h), s, o);
  }
}, DS = (i, a) => {
  let s = i;
  const o = a.split(cu), c = o.length;
  for (let d = 0; d < c; d++) {
    const f = o[d];
    let h = s.nextPart.get(f);
    h || (h = wS(), s.nextPart.set(f, h)), s = h;
  }
  return s;
}, mO = (i) => "isThemeGetter" in i && i.isThemeGetter === !0, pO = (i) => {
  if (i < 1)
    return {
      get: () => {
      },
      set: () => {
      }
    };
  let a = 0, s = /* @__PURE__ */ Object.create(null), o = /* @__PURE__ */ Object.create(null);
  const c = (d, f) => {
    s[d] = f, a++, a > i && (a = 0, o = s, s = /* @__PURE__ */ Object.create(null));
  };
  return {
    get(d) {
      let f = s[d];
      if (f !== void 0)
        return f;
      if ((f = o[d]) !== void 0)
        return c(d, f), f;
    },
    set(d, f) {
      d in s ? s[d] = f : c(d, f);
    }
  };
}, sh = "!", Sb = ":", gO = [], Tb = (i, a, s, o, c) => ({
  modifiers: i,
  hasImportantModifier: a,
  baseClassName: s,
  maybePostfixModifierPosition: o,
  isExternal: c
}), yO = (i) => {
  const {
    prefix: a,
    experimentalParseClassName: s
  } = i;
  let o = (c) => {
    const d = [];
    let f = 0, h = 0, p = 0, g;
    const v = c.length;
    for (let w = 0; w < v; w++) {
      const M = c[w];
      if (f === 0 && h === 0) {
        if (M === Sb) {
          d.push(c.slice(p, w)), p = w + 1;
          continue;
        }
        if (M === "/") {
          g = w;
          continue;
        }
      }
      M === "[" ? f++ : M === "]" ? f-- : M === "(" ? h++ : M === ")" && h--;
    }
    const y = d.length === 0 ? c : c.slice(p);
    let S = y, E = !1;
    y.endsWith(sh) ? (S = y.slice(0, -1), E = !0) : (
      /**
       * In Tailwind CSS v3 the important modifier was at the start of the base class name. This is still supported for legacy reasons.
       * @see https://github.com/dcastil/tailwind-merge/issues/513#issuecomment-2614029864
       */
      y.startsWith(sh) && (S = y.slice(1), E = !0)
    );
    const A = g && g > p ? g - p : void 0;
    return Tb(d, E, S, A);
  };
  if (a) {
    const c = a + Sb, d = o;
    o = (f) => f.startsWith(c) ? d(f.slice(c.length)) : Tb(gO, !1, f, void 0, !0);
  }
  if (s) {
    const c = o;
    o = (d) => s({
      className: d,
      parseClassName: c
    });
  }
  return o;
}, vO = (i) => {
  const a = /* @__PURE__ */ new Map();
  return i.orderSensitiveModifiers.forEach((s, o) => {
    a.set(s, 1e6 + o);
  }), (s) => {
    const o = [];
    let c = [];
    for (let d = 0; d < s.length; d++) {
      const f = s[d], h = f[0] === "[", p = a.has(f);
      h || p ? (c.length > 0 && (c.sort(), o.push(...c), c = []), o.push(f)) : c.push(f);
    }
    return c.length > 0 && (c.sort(), o.push(...c)), o;
  };
}, bO = (i) => ({
  cache: pO(i.cacheSize),
  parseClassName: yO(i),
  sortModifiers: vO(i),
  postfixLookupClassGroupIds: SO(i),
  ...sO(i)
}), SO = (i) => {
  const a = /* @__PURE__ */ Object.create(null), s = i.postfixLookupClassGroups;
  if (s)
    for (let o = 0; o < s.length; o++)
      a[s[o]] = !0;
  return a;
}, TO = /\s+/, EO = (i, a) => {
  const {
    parseClassName: s,
    getClassGroupId: o,
    getConflictingClassGroupIds: c,
    sortModifiers: d,
    postfixLookupClassGroupIds: f
  } = a, h = [], p = i.trim().split(TO);
  let g = "";
  for (let v = p.length - 1; v >= 0; v -= 1) {
    const y = p[v], {
      isExternal: S,
      modifiers: E,
      hasImportantModifier: A,
      baseClassName: w,
      maybePostfixModifierPosition: M
    } = s(y);
    if (S) {
      g = y + (g.length > 0 ? " " + g : g);
      continue;
    }
    let C = !!M, N;
    if (C) {
      const z = w.substring(0, M);
      N = o(z);
      const D = N && f[N] ? o(w) : void 0;
      D && D !== N && (N = D, C = !1);
    } else
      N = o(w);
    if (!N) {
      if (!C) {
        g = y + (g.length > 0 ? " " + g : g);
        continue;
      }
      if (N = o(w), !N) {
        g = y + (g.length > 0 ? " " + g : g);
        continue;
      }
      C = !1;
    }
    const H = E.length === 0 ? "" : E.length === 1 ? E[0] : d(E).join(":"), X = A ? H + sh : H, I = X + N;
    if (h.indexOf(I) > -1)
      continue;
    h.push(I);
    const et = c(N, C);
    for (let z = 0; z < et.length; ++z) {
      const D = et[z];
      h.push(X + D);
    }
    g = y + (g.length > 0 ? " " + g : g);
  }
  return g;
}, AO = (...i) => {
  let a = 0, s, o, c = "";
  for (; a < i.length; )
    (s = i[a++]) && (o = OS(s)) && (c && (c += " "), c += o);
  return c;
}, OS = (i) => {
  if (typeof i == "string")
    return i;
  let a, s = "";
  for (let o = 0; o < i.length; o++)
    i[o] && (a = OS(i[o])) && (s && (s += " "), s += a);
  return s;
}, xO = (i, ...a) => {
  let s, o, c, d;
  const f = (p) => {
    const g = a.reduce((v, y) => y(v), i());
    return s = bO(g), o = s.cache.get, c = s.cache.set, d = h, h(p);
  }, h = (p) => {
    const g = o(p);
    if (g)
      return g;
    const v = EO(p, s);
    return c(p, v), v;
  };
  return d = f, (...p) => d(AO(...p));
}, MO = [], fe = (i) => {
  const a = (s) => s[i] || MO;
  return a.isThemeGetter = !0, a.themeKey = i, a;
}, zS = /^\[(?:(\w[\w-]*):)?(.+)\]$/i, RS = /^\((?:(\w[\w-]*):)?(.+)\)$/i, wO = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, CO = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, DO = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, OO = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix|color|light-dark)\(.+\)$/, zO = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, RO = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/, Ui = (i) => wO.test(i), Ot = (i) => !!i && !Number.isNaN(Number(i)), Hn = (i) => !!i && Number.isInteger(Number(i)), Cd = (i) => i.endsWith("%") && Ot(i.slice(0, -1)), ii = (i) => CO.test(i), NS = () => !0, NO = (i) => (
  // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
  // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
  // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
  DO.test(i) && !OO.test(i)
), em = () => !1, _O = (i) => zO.test(i), VO = (i) => RO.test(i), LO = (i) => !mt(i) && !pt(i), UO = (i) => i.startsWith("@container") && (i[10] === "/" && i[11] !== void 0 || i[11] === "s" && i[16] !== void 0 && i.startsWith("-size/", 10) || i[11] === "n" && i[18] !== void 0 && i.startsWith("-normal/", 10)), BO = (i) => qi(i, LS, em), mt = (i) => zS.test(i), pa = (i) => qi(i, US, NO), Eb = (i) => qi(i, ZO, Ot), HO = (i) => qi(i, HS, NS), jO = (i) => qi(i, BS, em), Ab = (i) => qi(i, _S, em), GO = (i) => qi(i, VS, VO), Lr = (i) => qi(i, jS, _O), pt = (i) => RS.test(i), Ls = (i) => Ma(i, US), YO = (i) => Ma(i, BS), xb = (i) => Ma(i, _S), qO = (i) => Ma(i, LS), XO = (i) => Ma(i, VS), Ur = (i) => Ma(i, jS, !0), QO = (i) => Ma(i, HS, !0), qi = (i, a, s) => {
  const o = zS.exec(i);
  return o ? o[1] ? a(o[1]) : s(o[2]) : !1;
}, Ma = (i, a, s = !1) => {
  const o = RS.exec(i);
  return o ? o[1] ? a(o[1]) : s : !1;
}, _S = (i) => i === "position" || i === "percentage", VS = (i) => i === "image" || i === "url", LS = (i) => i === "length" || i === "size" || i === "bg-size", US = (i) => i === "length", ZO = (i) => i === "number", BS = (i) => i === "family-name", HS = (i) => i === "number" || i === "weight", jS = (i) => i === "shadow", KO = () => {
  const i = fe("color"), a = fe("font"), s = fe("text"), o = fe("font-weight"), c = fe("tracking"), d = fe("leading"), f = fe("breakpoint"), h = fe("container"), p = fe("spacing"), g = fe("radius"), v = fe("shadow"), y = fe("inset-shadow"), S = fe("text-shadow"), E = fe("drop-shadow"), A = fe("blur"), w = fe("perspective"), M = fe("aspect"), C = fe("ease"), N = fe("animate"), H = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"], X = () => [
    "center",
    "top",
    "bottom",
    "left",
    "right",
    "top-left",
    // Deprecated since Tailwind CSS v4.1.0, see https://github.com/tailwindlabs/tailwindcss/pull/17378
    "left-top",
    "top-right",
    // Deprecated since Tailwind CSS v4.1.0, see https://github.com/tailwindlabs/tailwindcss/pull/17378
    "right-top",
    "bottom-right",
    // Deprecated since Tailwind CSS v4.1.0, see https://github.com/tailwindlabs/tailwindcss/pull/17378
    "right-bottom",
    "bottom-left",
    // Deprecated since Tailwind CSS v4.1.0, see https://github.com/tailwindlabs/tailwindcss/pull/17378
    "left-bottom"
  ], I = () => [...X(), pt, mt], et = () => ["auto", "hidden", "clip", "visible", "scroll"], z = () => ["auto", "contain", "none"], D = () => [pt, mt, p], at = () => [Ui, "full", "auto", ...D()], lt = () => [Hn, "none", "subgrid", pt, mt], st = () => ["auto", {
    span: ["full", Hn, pt, mt]
  }, Hn, pt, mt], dt = () => [Hn, "auto", pt, mt], vt = () => ["auto", "min", "max", "fr", pt, mt], xt = () => ["start", "end", "center", "between", "around", "evenly", "stretch", "baseline", "center-safe", "end-safe"], St = () => ["start", "end", "center", "stretch", "center-safe", "end-safe"], F = () => ["auto", ...D()], rt = () => [Ui, "auto", "full", "dvw", "dvh", "lvw", "lvh", "svw", "svh", "min", "max", "fit", ...D()], ut = () => [h, Ui, "screen", "full", "dvw", "lvw", "svw", "min", "max", "fit", ...D()], nt = () => [Ui, "screen", "full", "lh", "dvh", "lvh", "svh", "min", "max", "fit", ...D()], L = () => [i, pt, mt], K = () => [...X(), xb, Ab, {
    position: [pt, mt]
  }], $ = () => ["no-repeat", {
    repeat: ["", "x", "y", "space", "round"]
  }], tt = () => ["auto", "cover", "contain", qO, BO, {
    size: [pt, mt]
  }], T = () => [Cd, Ls, pa], U = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    "full",
    g,
    pt,
    mt
  ], k = () => ["", Ot, Ls, pa], J = () => ["solid", "dashed", "dotted", "double"], it = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"], W = () => [Ot, Cd, xb, Ab], ft = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    A,
    pt,
    mt
  ], P = () => ["none", Ot, pt, mt], G = () => ["none", Ot, pt, mt], ct = () => [Ot, pt, mt], Tt = () => [Ui, "full", ...D()];
  return {
    cacheSize: 500,
    theme: {
      animate: ["spin", "ping", "pulse", "bounce"],
      aspect: ["video"],
      blur: [ii],
      breakpoint: [ii],
      color: [NS],
      container: [ii],
      "drop-shadow": [ii],
      ease: ["in", "out", "in-out"],
      font: [LO],
      "font-weight": ["thin", "extralight", "light", "normal", "medium", "semibold", "bold", "extrabold", "black"],
      "inset-shadow": [ii],
      leading: ["none", "tight", "snug", "normal", "relaxed", "loose"],
      perspective: ["dramatic", "near", "normal", "midrange", "distant", "none"],
      radius: [ii],
      shadow: [ii],
      spacing: ["px", Ot],
      text: [ii],
      "text-shadow": [ii],
      tracking: ["tighter", "tight", "normal", "wide", "wider", "widest"]
    },
    classGroups: {
      // --------------
      // --- Layout ---
      // --------------
      /**
       * Aspect Ratio
       * @see https://tailwindcss.com/docs/aspect-ratio
       */
      aspect: [{
        aspect: ["auto", "square", Ui, mt, pt, M]
      }],
      /**
       * Container
       * @see https://tailwindcss.com/docs/container
       * @deprecated since Tailwind CSS v4.0.0
       */
      container: ["container"],
      /**
       * Container Type
       * @see https://tailwindcss.com/docs/responsive-design#container-queries
       */
      "container-type": [{
        "@container": ["", "normal", "size", pt, mt]
      }],
      /**
       * Container Name
       * @see https://tailwindcss.com/docs/responsive-design#named-containers
       */
      "container-named": [UO],
      /**
       * Columns
       * @see https://tailwindcss.com/docs/columns
       */
      columns: [{
        columns: [Ot, "auto", mt, pt, h]
      }],
      /**
       * Break After
       * @see https://tailwindcss.com/docs/break-after
       */
      "break-after": [{
        "break-after": H()
      }],
      /**
       * Break Before
       * @see https://tailwindcss.com/docs/break-before
       */
      "break-before": [{
        "break-before": H()
      }],
      /**
       * Break Inside
       * @see https://tailwindcss.com/docs/break-inside
       */
      "break-inside": [{
        "break-inside": ["auto", "avoid", "avoid-page", "avoid-column"]
      }],
      /**
       * Box Decoration Break
       * @see https://tailwindcss.com/docs/box-decoration-break
       */
      "box-decoration": [{
        "box-decoration": ["slice", "clone"]
      }],
      /**
       * Box Sizing
       * @see https://tailwindcss.com/docs/box-sizing
       */
      box: [{
        box: ["border", "content"]
      }],
      /**
       * Display
       * @see https://tailwindcss.com/docs/display
       */
      display: ["block", "inline-block", "inline", "flex", "inline-flex", "table", "inline-table", "table-caption", "table-cell", "table-column", "table-column-group", "table-footer-group", "table-header-group", "table-row-group", "table-row", "flow-root", "grid", "inline-grid", "contents", "list-item", "hidden"],
      /**
       * Screen Reader Only
       * @see https://tailwindcss.com/docs/display#screen-reader-only
       */
      sr: ["sr-only", "not-sr-only"],
      /**
       * Floats
       * @see https://tailwindcss.com/docs/float
       */
      float: [{
        float: ["right", "left", "none", "start", "end"]
      }],
      /**
       * Clear
       * @see https://tailwindcss.com/docs/clear
       */
      clear: [{
        clear: ["left", "right", "both", "none", "start", "end"]
      }],
      /**
       * Isolation
       * @see https://tailwindcss.com/docs/isolation
       */
      isolation: ["isolate", "isolation-auto"],
      /**
       * Object Fit
       * @see https://tailwindcss.com/docs/object-fit
       */
      "object-fit": [{
        object: ["contain", "cover", "fill", "none", "scale-down"]
      }],
      /**
       * Object Position
       * @see https://tailwindcss.com/docs/object-position
       */
      "object-position": [{
        object: I()
      }],
      /**
       * Overflow
       * @see https://tailwindcss.com/docs/overflow
       */
      overflow: [{
        overflow: et()
      }],
      /**
       * Overflow X
       * @see https://tailwindcss.com/docs/overflow
       */
      "overflow-x": [{
        "overflow-x": et()
      }],
      /**
       * Overflow Y
       * @see https://tailwindcss.com/docs/overflow
       */
      "overflow-y": [{
        "overflow-y": et()
      }],
      /**
       * Overscroll Behavior
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      overscroll: [{
        overscroll: z()
      }],
      /**
       * Overscroll Behavior X
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      "overscroll-x": [{
        "overscroll-x": z()
      }],
      /**
       * Overscroll Behavior Y
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      "overscroll-y": [{
        "overscroll-y": z()
      }],
      /**
       * Position
       * @see https://tailwindcss.com/docs/position
       */
      position: ["static", "fixed", "absolute", "relative", "sticky"],
      /**
       * Inset
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      inset: [{
        inset: at()
      }],
      /**
       * Inset Inline
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-x": [{
        "inset-x": at()
      }],
      /**
       * Inset Block
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-y": [{
        "inset-y": at()
      }],
      /**
       * Inset Inline Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       * @todo class group will be renamed to `inset-s` in next major release
       */
      start: [{
        "inset-s": at(),
        /**
         * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-s-*` utilities.
         * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
         */
        start: at()
      }],
      /**
       * Inset Inline End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       * @todo class group will be renamed to `inset-e` in next major release
       */
      end: [{
        "inset-e": at(),
        /**
         * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-e-*` utilities.
         * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
         */
        end: at()
      }],
      /**
       * Inset Block Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-bs": [{
        "inset-bs": at()
      }],
      /**
       * Inset Block End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-be": [{
        "inset-be": at()
      }],
      /**
       * Top
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      top: [{
        top: at()
      }],
      /**
       * Right
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      right: [{
        right: at()
      }],
      /**
       * Bottom
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      bottom: [{
        bottom: at()
      }],
      /**
       * Left
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      left: [{
        left: at()
      }],
      /**
       * Visibility
       * @see https://tailwindcss.com/docs/visibility
       */
      visibility: ["visible", "invisible", "collapse"],
      /**
       * Z-Index
       * @see https://tailwindcss.com/docs/z-index
       */
      z: [{
        z: [Hn, "auto", pt, mt]
      }],
      // ------------------------
      // --- Flexbox and Grid ---
      // ------------------------
      /**
       * Flex Basis
       * @see https://tailwindcss.com/docs/flex-basis
       */
      basis: [{
        basis: [Ui, "full", "auto", h, ...D()]
      }],
      /**
       * Flex Direction
       * @see https://tailwindcss.com/docs/flex-direction
       */
      "flex-direction": [{
        flex: ["row", "row-reverse", "col", "col-reverse"]
      }],
      /**
       * Flex Wrap
       * @see https://tailwindcss.com/docs/flex-wrap
       */
      "flex-wrap": [{
        flex: ["nowrap", "wrap", "wrap-reverse"]
      }],
      /**
       * Flex
       * @see https://tailwindcss.com/docs/flex
       */
      flex: [{
        flex: [Ot, Ui, "auto", "initial", "none", mt]
      }],
      /**
       * Flex Grow
       * @see https://tailwindcss.com/docs/flex-grow
       */
      grow: [{
        grow: ["", Ot, pt, mt]
      }],
      /**
       * Flex Shrink
       * @see https://tailwindcss.com/docs/flex-shrink
       */
      shrink: [{
        shrink: ["", Ot, pt, mt]
      }],
      /**
       * Order
       * @see https://tailwindcss.com/docs/order
       */
      order: [{
        order: [Hn, "first", "last", "none", pt, mt]
      }],
      /**
       * Grid Template Columns
       * @see https://tailwindcss.com/docs/grid-template-columns
       */
      "grid-cols": [{
        "grid-cols": lt()
      }],
      /**
       * Grid Column Start / End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-start-end": [{
        col: st()
      }],
      /**
       * Grid Column Start
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-start": [{
        "col-start": dt()
      }],
      /**
       * Grid Column End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-end": [{
        "col-end": dt()
      }],
      /**
       * Grid Template Rows
       * @see https://tailwindcss.com/docs/grid-template-rows
       */
      "grid-rows": [{
        "grid-rows": lt()
      }],
      /**
       * Grid Row Start / End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-start-end": [{
        row: st()
      }],
      /**
       * Grid Row Start
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-start": [{
        "row-start": dt()
      }],
      /**
       * Grid Row End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-end": [{
        "row-end": dt()
      }],
      /**
       * Grid Auto Flow
       * @see https://tailwindcss.com/docs/grid-auto-flow
       */
      "grid-flow": [{
        "grid-flow": ["row", "col", "dense", "row-dense", "col-dense"]
      }],
      /**
       * Grid Auto Columns
       * @see https://tailwindcss.com/docs/grid-auto-columns
       */
      "auto-cols": [{
        "auto-cols": vt()
      }],
      /**
       * Grid Auto Rows
       * @see https://tailwindcss.com/docs/grid-auto-rows
       */
      "auto-rows": [{
        "auto-rows": vt()
      }],
      /**
       * Gap
       * @see https://tailwindcss.com/docs/gap
       */
      gap: [{
        gap: D()
      }],
      /**
       * Gap X
       * @see https://tailwindcss.com/docs/gap
       */
      "gap-x": [{
        "gap-x": D()
      }],
      /**
       * Gap Y
       * @see https://tailwindcss.com/docs/gap
       */
      "gap-y": [{
        "gap-y": D()
      }],
      /**
       * Justify Content
       * @see https://tailwindcss.com/docs/justify-content
       */
      "justify-content": [{
        justify: [...xt(), "normal"]
      }],
      /**
       * Justify Items
       * @see https://tailwindcss.com/docs/justify-items
       */
      "justify-items": [{
        "justify-items": [...St(), "normal"]
      }],
      /**
       * Justify Self
       * @see https://tailwindcss.com/docs/justify-self
       */
      "justify-self": [{
        "justify-self": ["auto", ...St()]
      }],
      /**
       * Align Content
       * @see https://tailwindcss.com/docs/align-content
       */
      "align-content": [{
        content: ["normal", ...xt()]
      }],
      /**
       * Align Items
       * @see https://tailwindcss.com/docs/align-items
       */
      "align-items": [{
        items: [...St(), {
          baseline: ["", "last"]
        }]
      }],
      /**
       * Align Self
       * @see https://tailwindcss.com/docs/align-self
       */
      "align-self": [{
        self: ["auto", ...St(), {
          baseline: ["", "last"]
        }]
      }],
      /**
       * Place Content
       * @see https://tailwindcss.com/docs/place-content
       */
      "place-content": [{
        "place-content": xt()
      }],
      /**
       * Place Items
       * @see https://tailwindcss.com/docs/place-items
       */
      "place-items": [{
        "place-items": [...St(), "baseline"]
      }],
      /**
       * Place Self
       * @see https://tailwindcss.com/docs/place-self
       */
      "place-self": [{
        "place-self": ["auto", ...St()]
      }],
      // Spacing
      /**
       * Padding
       * @see https://tailwindcss.com/docs/padding
       */
      p: [{
        p: D()
      }],
      /**
       * Padding Inline
       * @see https://tailwindcss.com/docs/padding
       */
      px: [{
        px: D()
      }],
      /**
       * Padding Block
       * @see https://tailwindcss.com/docs/padding
       */
      py: [{
        py: D()
      }],
      /**
       * Padding Inline Start
       * @see https://tailwindcss.com/docs/padding
       */
      ps: [{
        ps: D()
      }],
      /**
       * Padding Inline End
       * @see https://tailwindcss.com/docs/padding
       */
      pe: [{
        pe: D()
      }],
      /**
       * Padding Block Start
       * @see https://tailwindcss.com/docs/padding
       */
      pbs: [{
        pbs: D()
      }],
      /**
       * Padding Block End
       * @see https://tailwindcss.com/docs/padding
       */
      pbe: [{
        pbe: D()
      }],
      /**
       * Padding Top
       * @see https://tailwindcss.com/docs/padding
       */
      pt: [{
        pt: D()
      }],
      /**
       * Padding Right
       * @see https://tailwindcss.com/docs/padding
       */
      pr: [{
        pr: D()
      }],
      /**
       * Padding Bottom
       * @see https://tailwindcss.com/docs/padding
       */
      pb: [{
        pb: D()
      }],
      /**
       * Padding Left
       * @see https://tailwindcss.com/docs/padding
       */
      pl: [{
        pl: D()
      }],
      /**
       * Margin
       * @see https://tailwindcss.com/docs/margin
       */
      m: [{
        m: F()
      }],
      /**
       * Margin Inline
       * @see https://tailwindcss.com/docs/margin
       */
      mx: [{
        mx: F()
      }],
      /**
       * Margin Block
       * @see https://tailwindcss.com/docs/margin
       */
      my: [{
        my: F()
      }],
      /**
       * Margin Inline Start
       * @see https://tailwindcss.com/docs/margin
       */
      ms: [{
        ms: F()
      }],
      /**
       * Margin Inline End
       * @see https://tailwindcss.com/docs/margin
       */
      me: [{
        me: F()
      }],
      /**
       * Margin Block Start
       * @see https://tailwindcss.com/docs/margin
       */
      mbs: [{
        mbs: F()
      }],
      /**
       * Margin Block End
       * @see https://tailwindcss.com/docs/margin
       */
      mbe: [{
        mbe: F()
      }],
      /**
       * Margin Top
       * @see https://tailwindcss.com/docs/margin
       */
      mt: [{
        mt: F()
      }],
      /**
       * Margin Right
       * @see https://tailwindcss.com/docs/margin
       */
      mr: [{
        mr: F()
      }],
      /**
       * Margin Bottom
       * @see https://tailwindcss.com/docs/margin
       */
      mb: [{
        mb: F()
      }],
      /**
       * Margin Left
       * @see https://tailwindcss.com/docs/margin
       */
      ml: [{
        ml: F()
      }],
      /**
       * Space Between X
       * @see https://tailwindcss.com/docs/margin#adding-space-between-children
       */
      "space-x": [{
        "space-x": D()
      }],
      /**
       * Space Between X Reverse
       * @see https://tailwindcss.com/docs/margin#adding-space-between-children
       */
      "space-x-reverse": ["space-x-reverse"],
      /**
       * Space Between Y
       * @see https://tailwindcss.com/docs/margin#adding-space-between-children
       */
      "space-y": [{
        "space-y": D()
      }],
      /**
       * Space Between Y Reverse
       * @see https://tailwindcss.com/docs/margin#adding-space-between-children
       */
      "space-y-reverse": ["space-y-reverse"],
      // --------------
      // --- Sizing ---
      // --------------
      /**
       * Size
       * @see https://tailwindcss.com/docs/width#setting-both-width-and-height
       */
      size: [{
        size: rt()
      }],
      /**
       * Inline Size
       * @see https://tailwindcss.com/docs/inline-size
       */
      "inline-size": [{
        inline: ["auto", ...ut()]
      }],
      /**
       * Min-Inline Size
       * @see https://tailwindcss.com/docs/min-inline-size
       */
      "min-inline-size": [{
        "min-inline": ["auto", ...ut()]
      }],
      /**
       * Max-Inline Size
       * @see https://tailwindcss.com/docs/max-inline-size
       */
      "max-inline-size": [{
        "max-inline": ["none", ...ut()]
      }],
      /**
       * Block Size
       * @see https://tailwindcss.com/docs/block-size
       */
      "block-size": [{
        block: ["auto", ...nt()]
      }],
      /**
       * Min-Block Size
       * @see https://tailwindcss.com/docs/min-block-size
       */
      "min-block-size": [{
        "min-block": ["auto", ...nt()]
      }],
      /**
       * Max-Block Size
       * @see https://tailwindcss.com/docs/max-block-size
       */
      "max-block-size": [{
        "max-block": ["none", ...nt()]
      }],
      /**
       * Width
       * @see https://tailwindcss.com/docs/width
       */
      w: [{
        w: [h, "screen", ...rt()]
      }],
      /**
       * Min-Width
       * @see https://tailwindcss.com/docs/min-width
       */
      "min-w": [{
        "min-w": [
          h,
          "screen",
          /** Deprecated. @see https://github.com/tailwindlabs/tailwindcss.com/issues/2027#issuecomment-2620152757 */
          "none",
          ...rt()
        ]
      }],
      /**
       * Max-Width
       * @see https://tailwindcss.com/docs/max-width
       */
      "max-w": [{
        "max-w": [
          h,
          "screen",
          "none",
          /** Deprecated since Tailwind CSS v4.0.0. @see https://github.com/tailwindlabs/tailwindcss.com/issues/2027#issuecomment-2620152757 */
          "prose",
          /** Deprecated since Tailwind CSS v4.0.0. @see https://github.com/tailwindlabs/tailwindcss.com/issues/2027#issuecomment-2620152757 */
          {
            screen: [f]
          },
          ...rt()
        ]
      }],
      /**
       * Height
       * @see https://tailwindcss.com/docs/height
       */
      h: [{
        h: ["screen", "lh", ...rt()]
      }],
      /**
       * Min-Height
       * @see https://tailwindcss.com/docs/min-height
       */
      "min-h": [{
        "min-h": ["screen", "lh", "none", ...rt()]
      }],
      /**
       * Max-Height
       * @see https://tailwindcss.com/docs/max-height
       */
      "max-h": [{
        "max-h": ["screen", "lh", "none", ...rt()]
      }],
      // ------------------
      // --- Typography ---
      // ------------------
      /**
       * Font Size
       * @see https://tailwindcss.com/docs/font-size
       */
      "font-size": [{
        text: ["base", s, Ls, pa]
      }],
      /**
       * Font Smoothing
       * @see https://tailwindcss.com/docs/font-smoothing
       */
      "font-smoothing": ["antialiased", "subpixel-antialiased"],
      /**
       * Font Style
       * @see https://tailwindcss.com/docs/font-style
       */
      "font-style": ["italic", "not-italic"],
      /**
       * Font Weight
       * @see https://tailwindcss.com/docs/font-weight
       */
      "font-weight": [{
        font: [o, QO, HO]
      }],
      /**
       * Font Stretch
       * @see https://tailwindcss.com/docs/font-stretch
       */
      "font-stretch": [{
        "font-stretch": ["ultra-condensed", "extra-condensed", "condensed", "semi-condensed", "normal", "semi-expanded", "expanded", "extra-expanded", "ultra-expanded", Cd, mt]
      }],
      /**
       * Font Family
       * @see https://tailwindcss.com/docs/font-family
       */
      "font-family": [{
        font: [YO, jO, a]
      }],
      /**
       * Font Feature Settings
       * @see https://tailwindcss.com/docs/font-feature-settings
       */
      "font-features": [{
        "font-features": [mt]
      }],
      /**
       * Font Variant Numeric
       * @see https://tailwindcss.com/docs/font-variant-numeric
       */
      "fvn-normal": ["normal-nums"],
      /**
       * Font Variant Numeric
       * @see https://tailwindcss.com/docs/font-variant-numeric
       */
      "fvn-ordinal": ["ordinal"],
      /**
       * Font Variant Numeric
       * @see https://tailwindcss.com/docs/font-variant-numeric
       */
      "fvn-slashed-zero": ["slashed-zero"],
      /**
       * Font Variant Numeric
       * @see https://tailwindcss.com/docs/font-variant-numeric
       */
      "fvn-figure": ["lining-nums", "oldstyle-nums"],
      /**
       * Font Variant Numeric
       * @see https://tailwindcss.com/docs/font-variant-numeric
       */
      "fvn-spacing": ["proportional-nums", "tabular-nums"],
      /**
       * Font Variant Numeric
       * @see https://tailwindcss.com/docs/font-variant-numeric
       */
      "fvn-fraction": ["diagonal-fractions", "stacked-fractions"],
      /**
       * Letter Spacing
       * @see https://tailwindcss.com/docs/letter-spacing
       */
      tracking: [{
        tracking: [c, pt, mt]
      }],
      /**
       * Line Clamp
       * @see https://tailwindcss.com/docs/line-clamp
       */
      "line-clamp": [{
        "line-clamp": [Ot, "none", pt, Eb]
      }],
      /**
       * Line Height
       * @see https://tailwindcss.com/docs/line-height
       */
      leading: [{
        leading: [
          "none",
          /** Deprecated since Tailwind CSS v4.0.0. @see https://github.com/tailwindlabs/tailwindcss.com/issues/2027#issuecomment-2620152757 */
          d,
          ...D()
        ]
      }],
      /**
       * List Style Image
       * @see https://tailwindcss.com/docs/list-style-image
       */
      "list-image": [{
        "list-image": ["none", pt, mt]
      }],
      /**
       * List Style Position
       * @see https://tailwindcss.com/docs/list-style-position
       */
      "list-style-position": [{
        list: ["inside", "outside"]
      }],
      /**
       * List Style Type
       * @see https://tailwindcss.com/docs/list-style-type
       */
      "list-style-type": [{
        list: ["disc", "decimal", "none", pt, mt]
      }],
      /**
       * Text Alignment
       * @see https://tailwindcss.com/docs/text-align
       */
      "text-alignment": [{
        text: ["left", "center", "right", "justify", "start", "end"]
      }],
      /**
       * Placeholder Color
       * @deprecated since Tailwind CSS v3.0.0
       * @see https://v3.tailwindcss.com/docs/placeholder-color
       */
      "placeholder-color": [{
        placeholder: L()
      }],
      /**
       * Text Color
       * @see https://tailwindcss.com/docs/text-color
       */
      "text-color": [{
        text: L()
      }],
      /**
       * Text Decoration
       * @see https://tailwindcss.com/docs/text-decoration
       */
      "text-decoration": ["underline", "overline", "line-through", "no-underline"],
      /**
       * Text Decoration Style
       * @see https://tailwindcss.com/docs/text-decoration-style
       */
      "text-decoration-style": [{
        decoration: [...J(), "wavy"]
      }],
      /**
       * Text Decoration Thickness
       * @see https://tailwindcss.com/docs/text-decoration-thickness
       */
      "text-decoration-thickness": [{
        decoration: [Ot, "from-font", "auto", pt, pa]
      }],
      /**
       * Text Decoration Color
       * @see https://tailwindcss.com/docs/text-decoration-color
       */
      "text-decoration-color": [{
        decoration: L()
      }],
      /**
       * Text Underline Offset
       * @see https://tailwindcss.com/docs/text-underline-offset
       */
      "underline-offset": [{
        "underline-offset": [Ot, "auto", pt, mt]
      }],
      /**
       * Text Transform
       * @see https://tailwindcss.com/docs/text-transform
       */
      "text-transform": ["uppercase", "lowercase", "capitalize", "normal-case"],
      /**
       * Text Overflow
       * @see https://tailwindcss.com/docs/text-overflow
       */
      "text-overflow": ["truncate", "text-ellipsis", "text-clip"],
      /**
       * Text Wrap
       * @see https://tailwindcss.com/docs/text-wrap
       */
      "text-wrap": [{
        text: ["wrap", "nowrap", "balance", "pretty"]
      }],
      /**
       * Text Indent
       * @see https://tailwindcss.com/docs/text-indent
       */
      indent: [{
        indent: D()
      }],
      /**
       * Tab Size
       * @see https://tailwindcss.com/docs/tab-size
       */
      "tab-size": [{
        tab: [Hn, pt, mt]
      }],
      /**
       * Vertical Alignment
       * @see https://tailwindcss.com/docs/vertical-align
       */
      "vertical-align": [{
        align: ["baseline", "top", "middle", "bottom", "text-top", "text-bottom", "sub", "super", pt, mt]
      }],
      /**
       * Whitespace
       * @see https://tailwindcss.com/docs/whitespace
       */
      whitespace: [{
        whitespace: ["normal", "nowrap", "pre", "pre-line", "pre-wrap", "break-spaces"]
      }],
      /**
       * Word Break
       * @see https://tailwindcss.com/docs/word-break
       */
      break: [{
        break: ["normal", "words", "all", "keep"]
      }],
      /**
       * Overflow Wrap
       * @see https://tailwindcss.com/docs/overflow-wrap
       */
      wrap: [{
        wrap: ["break-word", "anywhere", "normal"]
      }],
      /**
       * Hyphens
       * @see https://tailwindcss.com/docs/hyphens
       */
      hyphens: [{
        hyphens: ["none", "manual", "auto"]
      }],
      /**
       * Content
       * @see https://tailwindcss.com/docs/content
       */
      content: [{
        content: ["none", pt, mt]
      }],
      // -------------------
      // --- Backgrounds ---
      // -------------------
      /**
       * Background Attachment
       * @see https://tailwindcss.com/docs/background-attachment
       */
      "bg-attachment": [{
        bg: ["fixed", "local", "scroll"]
      }],
      /**
       * Background Clip
       * @see https://tailwindcss.com/docs/background-clip
       */
      "bg-clip": [{
        "bg-clip": ["border", "padding", "content", "text"]
      }],
      /**
       * Background Origin
       * @see https://tailwindcss.com/docs/background-origin
       */
      "bg-origin": [{
        "bg-origin": ["border", "padding", "content"]
      }],
      /**
       * Background Position
       * @see https://tailwindcss.com/docs/background-position
       */
      "bg-position": [{
        bg: K()
      }],
      /**
       * Background Repeat
       * @see https://tailwindcss.com/docs/background-repeat
       */
      "bg-repeat": [{
        bg: $()
      }],
      /**
       * Background Size
       * @see https://tailwindcss.com/docs/background-size
       */
      "bg-size": [{
        bg: tt()
      }],
      /**
       * Background Image
       * @see https://tailwindcss.com/docs/background-image
       */
      "bg-image": [{
        bg: ["none", {
          linear: [{
            to: ["t", "tr", "r", "br", "b", "bl", "l", "tl"]
          }, Hn, pt, mt],
          radial: ["", pt, mt],
          conic: ["", Hn, pt, mt]
        }, XO, GO]
      }],
      /**
       * Background Color
       * @see https://tailwindcss.com/docs/background-color
       */
      "bg-color": [{
        bg: L()
      }],
      /**
       * Gradient Color Stops From Position
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-from-pos": [{
        from: T()
      }],
      /**
       * Gradient Color Stops Via Position
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-via-pos": [{
        via: T()
      }],
      /**
       * Gradient Color Stops To Position
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-to-pos": [{
        to: T()
      }],
      /**
       * Gradient Color Stops From
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-from": [{
        from: L()
      }],
      /**
       * Gradient Color Stops Via
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-via": [{
        via: L()
      }],
      /**
       * Gradient Color Stops To
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-to": [{
        to: L()
      }],
      // ---------------
      // --- Borders ---
      // ---------------
      /**
       * Border Radius
       * @see https://tailwindcss.com/docs/border-radius
       */
      rounded: [{
        rounded: U()
      }],
      /**
       * Border Radius Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-s": [{
        "rounded-s": U()
      }],
      /**
       * Border Radius End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-e": [{
        "rounded-e": U()
      }],
      /**
       * Border Radius Top
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-t": [{
        "rounded-t": U()
      }],
      /**
       * Border Radius Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-r": [{
        "rounded-r": U()
      }],
      /**
       * Border Radius Bottom
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-b": [{
        "rounded-b": U()
      }],
      /**
       * Border Radius Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-l": [{
        "rounded-l": U()
      }],
      /**
       * Border Radius Start Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-ss": [{
        "rounded-ss": U()
      }],
      /**
       * Border Radius Start End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-se": [{
        "rounded-se": U()
      }],
      /**
       * Border Radius End End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-ee": [{
        "rounded-ee": U()
      }],
      /**
       * Border Radius End Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-es": [{
        "rounded-es": U()
      }],
      /**
       * Border Radius Top Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-tl": [{
        "rounded-tl": U()
      }],
      /**
       * Border Radius Top Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-tr": [{
        "rounded-tr": U()
      }],
      /**
       * Border Radius Bottom Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-br": [{
        "rounded-br": U()
      }],
      /**
       * Border Radius Bottom Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-bl": [{
        "rounded-bl": U()
      }],
      /**
       * Border Width
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w": [{
        border: k()
      }],
      /**
       * Border Width Inline
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-x": [{
        "border-x": k()
      }],
      /**
       * Border Width Block
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-y": [{
        "border-y": k()
      }],
      /**
       * Border Width Inline Start
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-s": [{
        "border-s": k()
      }],
      /**
       * Border Width Inline End
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-e": [{
        "border-e": k()
      }],
      /**
       * Border Width Block Start
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-bs": [{
        "border-bs": k()
      }],
      /**
       * Border Width Block End
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-be": [{
        "border-be": k()
      }],
      /**
       * Border Width Top
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-t": [{
        "border-t": k()
      }],
      /**
       * Border Width Right
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-r": [{
        "border-r": k()
      }],
      /**
       * Border Width Bottom
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-b": [{
        "border-b": k()
      }],
      /**
       * Border Width Left
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-l": [{
        "border-l": k()
      }],
      /**
       * Divide Width X
       * @see https://tailwindcss.com/docs/border-width#between-children
       */
      "divide-x": [{
        "divide-x": k()
      }],
      /**
       * Divide Width X Reverse
       * @see https://tailwindcss.com/docs/border-width#between-children
       */
      "divide-x-reverse": ["divide-x-reverse"],
      /**
       * Divide Width Y
       * @see https://tailwindcss.com/docs/border-width#between-children
       */
      "divide-y": [{
        "divide-y": k()
      }],
      /**
       * Divide Width Y Reverse
       * @see https://tailwindcss.com/docs/border-width#between-children
       */
      "divide-y-reverse": ["divide-y-reverse"],
      /**
       * Border Style
       * @see https://tailwindcss.com/docs/border-style
       */
      "border-style": [{
        border: [...J(), "hidden", "none"]
      }],
      /**
       * Divide Style
       * @see https://tailwindcss.com/docs/border-style#setting-the-divider-style
       */
      "divide-style": [{
        divide: [...J(), "hidden", "none"]
      }],
      /**
       * Border Color
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color": [{
        border: L()
      }],
      /**
       * Border Color Inline
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-x": [{
        "border-x": L()
      }],
      /**
       * Border Color Block
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-y": [{
        "border-y": L()
      }],
      /**
       * Border Color Inline Start
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-s": [{
        "border-s": L()
      }],
      /**
       * Border Color Inline End
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-e": [{
        "border-e": L()
      }],
      /**
       * Border Color Block Start
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-bs": [{
        "border-bs": L()
      }],
      /**
       * Border Color Block End
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-be": [{
        "border-be": L()
      }],
      /**
       * Border Color Top
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-t": [{
        "border-t": L()
      }],
      /**
       * Border Color Right
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-r": [{
        "border-r": L()
      }],
      /**
       * Border Color Bottom
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-b": [{
        "border-b": L()
      }],
      /**
       * Border Color Left
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-l": [{
        "border-l": L()
      }],
      /**
       * Divide Color
       * @see https://tailwindcss.com/docs/divide-color
       */
      "divide-color": [{
        divide: L()
      }],
      /**
       * Outline Style
       * @see https://tailwindcss.com/docs/outline-style
       */
      "outline-style": [{
        outline: [...J(), "none", "hidden"]
      }],
      /**
       * Outline Offset
       * @see https://tailwindcss.com/docs/outline-offset
       */
      "outline-offset": [{
        "outline-offset": [Ot, pt, mt]
      }],
      /**
       * Outline Width
       * @see https://tailwindcss.com/docs/outline-width
       */
      "outline-w": [{
        outline: ["", Ot, Ls, pa]
      }],
      /**
       * Outline Color
       * @see https://tailwindcss.com/docs/outline-color
       */
      "outline-color": [{
        outline: L()
      }],
      // ---------------
      // --- Effects ---
      // ---------------
      /**
       * Box Shadow
       * @see https://tailwindcss.com/docs/box-shadow
       */
      shadow: [{
        shadow: [
          // Deprecated since Tailwind CSS v4.0.0
          "",
          // Deprecated since Tailwind CSS v4.0.0
          "inner",
          "none",
          v,
          Ur,
          Lr
        ]
      }],
      /**
       * Box Shadow Color
       * @see https://tailwindcss.com/docs/box-shadow#setting-the-shadow-color
       */
      "shadow-color": [{
        shadow: L()
      }],
      /**
       * Inset Box Shadow
       * @see https://tailwindcss.com/docs/box-shadow#adding-an-inset-shadow
       */
      "inset-shadow": [{
        "inset-shadow": ["none", y, Ur, Lr]
      }],
      /**
       * Inset Box Shadow Color
       * @see https://tailwindcss.com/docs/box-shadow#setting-the-inset-shadow-color
       */
      "inset-shadow-color": [{
        "inset-shadow": L()
      }],
      /**
       * Ring Width
       * @see https://tailwindcss.com/docs/box-shadow#adding-a-ring
       */
      "ring-w": [{
        ring: k()
      }],
      /**
       * Ring Width Inset
       * @see https://v3.tailwindcss.com/docs/ring-width#inset-rings
       * @deprecated since Tailwind CSS v4.0.0
       * @see https://github.com/tailwindlabs/tailwindcss/blob/v4.0.0/packages/tailwindcss/src/utilities.ts#L4158
       */
      "ring-w-inset": ["ring-inset"],
      /**
       * Ring Color
       * @see https://tailwindcss.com/docs/box-shadow#setting-the-ring-color
       */
      "ring-color": [{
        ring: L()
      }],
      /**
       * Ring Offset Width
       * @see https://v3.tailwindcss.com/docs/ring-offset-width
       * @deprecated since Tailwind CSS v4.0.0
       * @see https://github.com/tailwindlabs/tailwindcss/blob/v4.0.0/packages/tailwindcss/src/utilities.ts#L4158
       */
      "ring-offset-w": [{
        "ring-offset": [Ot, pa]
      }],
      /**
       * Ring Offset Color
       * @see https://v3.tailwindcss.com/docs/ring-offset-color
       * @deprecated since Tailwind CSS v4.0.0
       * @see https://github.com/tailwindlabs/tailwindcss/blob/v4.0.0/packages/tailwindcss/src/utilities.ts#L4158
       */
      "ring-offset-color": [{
        "ring-offset": L()
      }],
      /**
       * Inset Ring Width
       * @see https://tailwindcss.com/docs/box-shadow#adding-an-inset-ring
       */
      "inset-ring-w": [{
        "inset-ring": k()
      }],
      /**
       * Inset Ring Color
       * @see https://tailwindcss.com/docs/box-shadow#setting-the-inset-ring-color
       */
      "inset-ring-color": [{
        "inset-ring": L()
      }],
      /**
       * Text Shadow
       * @see https://tailwindcss.com/docs/text-shadow
       */
      "text-shadow": [{
        "text-shadow": ["none", S, Ur, Lr]
      }],
      /**
       * Text Shadow Color
       * @see https://tailwindcss.com/docs/text-shadow#setting-the-shadow-color
       */
      "text-shadow-color": [{
        "text-shadow": L()
      }],
      /**
       * Opacity
       * @see https://tailwindcss.com/docs/opacity
       */
      opacity: [{
        opacity: [Ot, pt, mt]
      }],
      /**
       * Mix Blend Mode
       * @see https://tailwindcss.com/docs/mix-blend-mode
       */
      "mix-blend": [{
        "mix-blend": [...it(), "plus-darker", "plus-lighter"]
      }],
      /**
       * Background Blend Mode
       * @see https://tailwindcss.com/docs/background-blend-mode
       */
      "bg-blend": [{
        "bg-blend": it()
      }],
      /**
       * Mask Clip
       * @see https://tailwindcss.com/docs/mask-clip
       */
      "mask-clip": [{
        "mask-clip": ["border", "padding", "content", "fill", "stroke", "view"]
      }, "mask-no-clip"],
      /**
       * Mask Composite
       * @see https://tailwindcss.com/docs/mask-composite
       */
      "mask-composite": [{
        mask: ["add", "subtract", "intersect", "exclude"]
      }],
      /**
       * Mask Image
       * @see https://tailwindcss.com/docs/mask-image
       */
      "mask-image-linear-pos": [{
        "mask-linear": [Ot]
      }],
      "mask-image-linear-from-pos": [{
        "mask-linear-from": W()
      }],
      "mask-image-linear-to-pos": [{
        "mask-linear-to": W()
      }],
      "mask-image-linear-from-color": [{
        "mask-linear-from": L()
      }],
      "mask-image-linear-to-color": [{
        "mask-linear-to": L()
      }],
      "mask-image-t-from-pos": [{
        "mask-t-from": W()
      }],
      "mask-image-t-to-pos": [{
        "mask-t-to": W()
      }],
      "mask-image-t-from-color": [{
        "mask-t-from": L()
      }],
      "mask-image-t-to-color": [{
        "mask-t-to": L()
      }],
      "mask-image-r-from-pos": [{
        "mask-r-from": W()
      }],
      "mask-image-r-to-pos": [{
        "mask-r-to": W()
      }],
      "mask-image-r-from-color": [{
        "mask-r-from": L()
      }],
      "mask-image-r-to-color": [{
        "mask-r-to": L()
      }],
      "mask-image-b-from-pos": [{
        "mask-b-from": W()
      }],
      "mask-image-b-to-pos": [{
        "mask-b-to": W()
      }],
      "mask-image-b-from-color": [{
        "mask-b-from": L()
      }],
      "mask-image-b-to-color": [{
        "mask-b-to": L()
      }],
      "mask-image-l-from-pos": [{
        "mask-l-from": W()
      }],
      "mask-image-l-to-pos": [{
        "mask-l-to": W()
      }],
      "mask-image-l-from-color": [{
        "mask-l-from": L()
      }],
      "mask-image-l-to-color": [{
        "mask-l-to": L()
      }],
      "mask-image-x-from-pos": [{
        "mask-x-from": W()
      }],
      "mask-image-x-to-pos": [{
        "mask-x-to": W()
      }],
      "mask-image-x-from-color": [{
        "mask-x-from": L()
      }],
      "mask-image-x-to-color": [{
        "mask-x-to": L()
      }],
      "mask-image-y-from-pos": [{
        "mask-y-from": W()
      }],
      "mask-image-y-to-pos": [{
        "mask-y-to": W()
      }],
      "mask-image-y-from-color": [{
        "mask-y-from": L()
      }],
      "mask-image-y-to-color": [{
        "mask-y-to": L()
      }],
      "mask-image-radial": [{
        "mask-radial": [pt, mt]
      }],
      "mask-image-radial-from-pos": [{
        "mask-radial-from": W()
      }],
      "mask-image-radial-to-pos": [{
        "mask-radial-to": W()
      }],
      "mask-image-radial-from-color": [{
        "mask-radial-from": L()
      }],
      "mask-image-radial-to-color": [{
        "mask-radial-to": L()
      }],
      "mask-image-radial-shape": [{
        "mask-radial": ["circle", "ellipse"]
      }],
      "mask-image-radial-size": [{
        "mask-radial": [{
          closest: ["side", "corner"],
          farthest: ["side", "corner"]
        }]
      }],
      "mask-image-radial-pos": [{
        "mask-radial-at": X()
      }],
      "mask-image-conic-pos": [{
        "mask-conic": [Ot]
      }],
      "mask-image-conic-from-pos": [{
        "mask-conic-from": W()
      }],
      "mask-image-conic-to-pos": [{
        "mask-conic-to": W()
      }],
      "mask-image-conic-from-color": [{
        "mask-conic-from": L()
      }],
      "mask-image-conic-to-color": [{
        "mask-conic-to": L()
      }],
      /**
       * Mask Mode
       * @see https://tailwindcss.com/docs/mask-mode
       */
      "mask-mode": [{
        mask: ["alpha", "luminance", "match"]
      }],
      /**
       * Mask Origin
       * @see https://tailwindcss.com/docs/mask-origin
       */
      "mask-origin": [{
        "mask-origin": ["border", "padding", "content", "fill", "stroke", "view"]
      }],
      /**
       * Mask Position
       * @see https://tailwindcss.com/docs/mask-position
       */
      "mask-position": [{
        mask: K()
      }],
      /**
       * Mask Repeat
       * @see https://tailwindcss.com/docs/mask-repeat
       */
      "mask-repeat": [{
        mask: $()
      }],
      /**
       * Mask Size
       * @see https://tailwindcss.com/docs/mask-size
       */
      "mask-size": [{
        mask: tt()
      }],
      /**
       * Mask Type
       * @see https://tailwindcss.com/docs/mask-type
       */
      "mask-type": [{
        "mask-type": ["alpha", "luminance"]
      }],
      /**
       * Mask Image
       * @see https://tailwindcss.com/docs/mask-image
       */
      "mask-image": [{
        mask: ["none", pt, mt]
      }],
      // ---------------
      // --- Filters ---
      // ---------------
      /**
       * Filter
       * @see https://tailwindcss.com/docs/filter
       */
      filter: [{
        filter: [
          // Deprecated since Tailwind CSS v3.0.0
          "",
          "none",
          pt,
          mt
        ]
      }],
      /**
       * Blur
       * @see https://tailwindcss.com/docs/blur
       */
      blur: [{
        blur: ft()
      }],
      /**
       * Brightness
       * @see https://tailwindcss.com/docs/brightness
       */
      brightness: [{
        brightness: [Ot, pt, mt]
      }],
      /**
       * Contrast
       * @see https://tailwindcss.com/docs/contrast
       */
      contrast: [{
        contrast: [Ot, pt, mt]
      }],
      /**
       * Drop Shadow
       * @see https://tailwindcss.com/docs/drop-shadow
       */
      "drop-shadow": [{
        "drop-shadow": [
          // Deprecated since Tailwind CSS v4.0.0
          "",
          "none",
          E,
          Ur,
          Lr
        ]
      }],
      /**
       * Drop Shadow Color
       * @see https://tailwindcss.com/docs/filter-drop-shadow#setting-the-shadow-color
       */
      "drop-shadow-color": [{
        "drop-shadow": L()
      }],
      /**
       * Grayscale
       * @see https://tailwindcss.com/docs/grayscale
       */
      grayscale: [{
        grayscale: ["", Ot, pt, mt]
      }],
      /**
       * Hue Rotate
       * @see https://tailwindcss.com/docs/hue-rotate
       */
      "hue-rotate": [{
        "hue-rotate": [Ot, pt, mt]
      }],
      /**
       * Invert
       * @see https://tailwindcss.com/docs/invert
       */
      invert: [{
        invert: ["", Ot, pt, mt]
      }],
      /**
       * Saturate
       * @see https://tailwindcss.com/docs/saturate
       */
      saturate: [{
        saturate: [Ot, pt, mt]
      }],
      /**
       * Sepia
       * @see https://tailwindcss.com/docs/sepia
       */
      sepia: [{
        sepia: ["", Ot, pt, mt]
      }],
      /**
       * Backdrop Filter
       * @see https://tailwindcss.com/docs/backdrop-filter
       */
      "backdrop-filter": [{
        "backdrop-filter": [
          // Deprecated since Tailwind CSS v3.0.0
          "",
          "none",
          pt,
          mt
        ]
      }],
      /**
       * Backdrop Blur
       * @see https://tailwindcss.com/docs/backdrop-blur
       */
      "backdrop-blur": [{
        "backdrop-blur": ft()
      }],
      /**
       * Backdrop Brightness
       * @see https://tailwindcss.com/docs/backdrop-brightness
       */
      "backdrop-brightness": [{
        "backdrop-brightness": [Ot, pt, mt]
      }],
      /**
       * Backdrop Contrast
       * @see https://tailwindcss.com/docs/backdrop-contrast
       */
      "backdrop-contrast": [{
        "backdrop-contrast": [Ot, pt, mt]
      }],
      /**
       * Backdrop Grayscale
       * @see https://tailwindcss.com/docs/backdrop-grayscale
       */
      "backdrop-grayscale": [{
        "backdrop-grayscale": ["", Ot, pt, mt]
      }],
      /**
       * Backdrop Hue Rotate
       * @see https://tailwindcss.com/docs/backdrop-hue-rotate
       */
      "backdrop-hue-rotate": [{
        "backdrop-hue-rotate": [Ot, pt, mt]
      }],
      /**
       * Backdrop Invert
       * @see https://tailwindcss.com/docs/backdrop-invert
       */
      "backdrop-invert": [{
        "backdrop-invert": ["", Ot, pt, mt]
      }],
      /**
       * Backdrop Opacity
       * @see https://tailwindcss.com/docs/backdrop-opacity
       */
      "backdrop-opacity": [{
        "backdrop-opacity": [Ot, pt, mt]
      }],
      /**
       * Backdrop Saturate
       * @see https://tailwindcss.com/docs/backdrop-saturate
       */
      "backdrop-saturate": [{
        "backdrop-saturate": [Ot, pt, mt]
      }],
      /**
       * Backdrop Sepia
       * @see https://tailwindcss.com/docs/backdrop-sepia
       */
      "backdrop-sepia": [{
        "backdrop-sepia": ["", Ot, pt, mt]
      }],
      // --------------
      // --- Tables ---
      // --------------
      /**
       * Border Collapse
       * @see https://tailwindcss.com/docs/border-collapse
       */
      "border-collapse": [{
        border: ["collapse", "separate"]
      }],
      /**
       * Border Spacing
       * @see https://tailwindcss.com/docs/border-spacing
       */
      "border-spacing": [{
        "border-spacing": D()
      }],
      /**
       * Border Spacing X
       * @see https://tailwindcss.com/docs/border-spacing
       */
      "border-spacing-x": [{
        "border-spacing-x": D()
      }],
      /**
       * Border Spacing Y
       * @see https://tailwindcss.com/docs/border-spacing
       */
      "border-spacing-y": [{
        "border-spacing-y": D()
      }],
      /**
       * Table Layout
       * @see https://tailwindcss.com/docs/table-layout
       */
      "table-layout": [{
        table: ["auto", "fixed"]
      }],
      /**
       * Caption Side
       * @see https://tailwindcss.com/docs/caption-side
       */
      caption: [{
        caption: ["top", "bottom"]
      }],
      // ---------------------------------
      // --- Transitions and Animation ---
      // ---------------------------------
      /**
       * Transition Property
       * @see https://tailwindcss.com/docs/transition-property
       */
      transition: [{
        transition: ["", "all", "colors", "opacity", "shadow", "transform", "none", pt, mt]
      }],
      /**
       * Transition Behavior
       * @see https://tailwindcss.com/docs/transition-behavior
       */
      "transition-behavior": [{
        transition: ["normal", "discrete"]
      }],
      /**
       * Transition Duration
       * @see https://tailwindcss.com/docs/transition-duration
       */
      duration: [{
        duration: [Ot, "initial", pt, mt]
      }],
      /**
       * Transition Timing Function
       * @see https://tailwindcss.com/docs/transition-timing-function
       */
      ease: [{
        ease: ["linear", "initial", C, pt, mt]
      }],
      /**
       * Transition Delay
       * @see https://tailwindcss.com/docs/transition-delay
       */
      delay: [{
        delay: [Ot, pt, mt]
      }],
      /**
       * Animation
       * @see https://tailwindcss.com/docs/animation
       */
      animate: [{
        animate: ["none", N, pt, mt]
      }],
      // ------------------
      // --- Transforms ---
      // ------------------
      /**
       * Backface Visibility
       * @see https://tailwindcss.com/docs/backface-visibility
       */
      backface: [{
        backface: ["hidden", "visible"]
      }],
      /**
       * Perspective
       * @see https://tailwindcss.com/docs/perspective
       */
      perspective: [{
        perspective: [w, pt, mt]
      }],
      /**
       * Perspective Origin
       * @see https://tailwindcss.com/docs/perspective-origin
       */
      "perspective-origin": [{
        "perspective-origin": I()
      }],
      /**
       * Rotate
       * @see https://tailwindcss.com/docs/rotate
       */
      rotate: [{
        rotate: P()
      }],
      /**
       * Rotate X
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-x": [{
        "rotate-x": P()
      }],
      /**
       * Rotate Y
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-y": [{
        "rotate-y": P()
      }],
      /**
       * Rotate Z
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-z": [{
        "rotate-z": P()
      }],
      /**
       * Scale
       * @see https://tailwindcss.com/docs/scale
       */
      scale: [{
        scale: G()
      }],
      /**
       * Scale X
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-x": [{
        "scale-x": G()
      }],
      /**
       * Scale Y
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-y": [{
        "scale-y": G()
      }],
      /**
       * Scale Z
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-z": [{
        "scale-z": G()
      }],
      /**
       * Scale 3D
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-3d": ["scale-3d"],
      /**
       * Skew
       * @see https://tailwindcss.com/docs/skew
       */
      skew: [{
        skew: ct()
      }],
      /**
       * Skew X
       * @see https://tailwindcss.com/docs/skew
       */
      "skew-x": [{
        "skew-x": ct()
      }],
      /**
       * Skew Y
       * @see https://tailwindcss.com/docs/skew
       */
      "skew-y": [{
        "skew-y": ct()
      }],
      /**
       * Transform
       * @see https://tailwindcss.com/docs/transform
       */
      transform: [{
        transform: [pt, mt, "", "none", "gpu", "cpu"]
      }],
      /**
       * Transform Origin
       * @see https://tailwindcss.com/docs/transform-origin
       */
      "transform-origin": [{
        origin: I()
      }],
      /**
       * Transform Style
       * @see https://tailwindcss.com/docs/transform-style
       */
      "transform-style": [{
        transform: ["3d", "flat"]
      }],
      /**
       * Translate
       * @see https://tailwindcss.com/docs/translate
       */
      translate: [{
        translate: Tt()
      }],
      /**
       * Translate X
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-x": [{
        "translate-x": Tt()
      }],
      /**
       * Translate Y
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-y": [{
        "translate-y": Tt()
      }],
      /**
       * Translate Z
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-z": [{
        "translate-z": Tt()
      }],
      /**
       * Translate None
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-none": ["translate-none"],
      /**
       * Zoom
       * @see https://tailwindcss.com/docs/zoom
       */
      zoom: [{
        zoom: [Hn, pt, mt]
      }],
      // ---------------------
      // --- Interactivity ---
      // ---------------------
      /**
       * Accent Color
       * @see https://tailwindcss.com/docs/accent-color
       */
      accent: [{
        accent: L()
      }],
      /**
       * Appearance
       * @see https://tailwindcss.com/docs/appearance
       */
      appearance: [{
        appearance: ["none", "auto"]
      }],
      /**
       * Caret Color
       * @see https://tailwindcss.com/docs/just-in-time-mode#caret-color-utilities
       */
      "caret-color": [{
        caret: L()
      }],
      /**
       * Color Scheme
       * @see https://tailwindcss.com/docs/color-scheme
       */
      "color-scheme": [{
        scheme: ["normal", "dark", "light", "light-dark", "only-dark", "only-light"]
      }],
      /**
       * Cursor
       * @see https://tailwindcss.com/docs/cursor
       */
      cursor: [{
        cursor: ["auto", "default", "pointer", "wait", "text", "move", "help", "not-allowed", "none", "context-menu", "progress", "cell", "crosshair", "vertical-text", "alias", "copy", "no-drop", "grab", "grabbing", "all-scroll", "col-resize", "row-resize", "n-resize", "e-resize", "s-resize", "w-resize", "ne-resize", "nw-resize", "se-resize", "sw-resize", "ew-resize", "ns-resize", "nesw-resize", "nwse-resize", "zoom-in", "zoom-out", pt, mt]
      }],
      /**
       * Field Sizing
       * @see https://tailwindcss.com/docs/field-sizing
       */
      "field-sizing": [{
        "field-sizing": ["fixed", "content"]
      }],
      /**
       * Pointer Events
       * @see https://tailwindcss.com/docs/pointer-events
       */
      "pointer-events": [{
        "pointer-events": ["auto", "none"]
      }],
      /**
       * Resize
       * @see https://tailwindcss.com/docs/resize
       */
      resize: [{
        resize: ["none", "", "y", "x"]
      }],
      /**
       * Scroll Behavior
       * @see https://tailwindcss.com/docs/scroll-behavior
       */
      "scroll-behavior": [{
        scroll: ["auto", "smooth"]
      }],
      /**
       * Scrollbar Thumb Color
       * @see https://tailwindcss.com/docs/scrollbar-color
       */
      "scrollbar-thumb-color": [{
        "scrollbar-thumb": L()
      }],
      /**
       * Scrollbar Track Color
       * @see https://tailwindcss.com/docs/scrollbar-color
       */
      "scrollbar-track-color": [{
        "scrollbar-track": L()
      }],
      /**
       * Scrollbar Gutter
       * @see https://tailwindcss.com/docs/scrollbar-gutter
       */
      "scrollbar-gutter": [{
        "scrollbar-gutter": ["auto", "stable", "both"]
      }],
      /**
       * Scrollbar Width
       * @see https://tailwindcss.com/docs/scrollbar-width
       */
      "scrollbar-w": [{
        scrollbar: ["auto", "thin", "none"]
      }],
      /**
       * Scroll Margin
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-m": [{
        "scroll-m": D()
      }],
      /**
       * Scroll Margin Inline
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mx": [{
        "scroll-mx": D()
      }],
      /**
       * Scroll Margin Block
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-my": [{
        "scroll-my": D()
      }],
      /**
       * Scroll Margin Inline Start
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-ms": [{
        "scroll-ms": D()
      }],
      /**
       * Scroll Margin Inline End
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-me": [{
        "scroll-me": D()
      }],
      /**
       * Scroll Margin Block Start
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mbs": [{
        "scroll-mbs": D()
      }],
      /**
       * Scroll Margin Block End
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mbe": [{
        "scroll-mbe": D()
      }],
      /**
       * Scroll Margin Top
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mt": [{
        "scroll-mt": D()
      }],
      /**
       * Scroll Margin Right
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mr": [{
        "scroll-mr": D()
      }],
      /**
       * Scroll Margin Bottom
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mb": [{
        "scroll-mb": D()
      }],
      /**
       * Scroll Margin Left
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-ml": [{
        "scroll-ml": D()
      }],
      /**
       * Scroll Padding
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-p": [{
        "scroll-p": D()
      }],
      /**
       * Scroll Padding Inline
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-px": [{
        "scroll-px": D()
      }],
      /**
       * Scroll Padding Block
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-py": [{
        "scroll-py": D()
      }],
      /**
       * Scroll Padding Inline Start
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-ps": [{
        "scroll-ps": D()
      }],
      /**
       * Scroll Padding Inline End
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pe": [{
        "scroll-pe": D()
      }],
      /**
       * Scroll Padding Block Start
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pbs": [{
        "scroll-pbs": D()
      }],
      /**
       * Scroll Padding Block End
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pbe": [{
        "scroll-pbe": D()
      }],
      /**
       * Scroll Padding Top
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pt": [{
        "scroll-pt": D()
      }],
      /**
       * Scroll Padding Right
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pr": [{
        "scroll-pr": D()
      }],
      /**
       * Scroll Padding Bottom
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pb": [{
        "scroll-pb": D()
      }],
      /**
       * Scroll Padding Left
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pl": [{
        "scroll-pl": D()
      }],
      /**
       * Scroll Snap Align
       * @see https://tailwindcss.com/docs/scroll-snap-align
       */
      "snap-align": [{
        snap: ["start", "end", "center", "align-none"]
      }],
      /**
       * Scroll Snap Stop
       * @see https://tailwindcss.com/docs/scroll-snap-stop
       */
      "snap-stop": [{
        snap: ["normal", "always"]
      }],
      /**
       * Scroll Snap Type
       * @see https://tailwindcss.com/docs/scroll-snap-type
       */
      "snap-type": [{
        snap: ["none", "x", "y", "both"]
      }],
      /**
       * Scroll Snap Type Strictness
       * @see https://tailwindcss.com/docs/scroll-snap-type
       */
      "snap-strictness": [{
        snap: ["mandatory", "proximity"]
      }],
      /**
       * Touch Action
       * @see https://tailwindcss.com/docs/touch-action
       */
      touch: [{
        touch: ["auto", "none", "manipulation"]
      }],
      /**
       * Touch Action X
       * @see https://tailwindcss.com/docs/touch-action
       */
      "touch-x": [{
        "touch-pan": ["x", "left", "right"]
      }],
      /**
       * Touch Action Y
       * @see https://tailwindcss.com/docs/touch-action
       */
      "touch-y": [{
        "touch-pan": ["y", "up", "down"]
      }],
      /**
       * Touch Action Pinch Zoom
       * @see https://tailwindcss.com/docs/touch-action
       */
      "touch-pz": ["touch-pinch-zoom"],
      /**
       * User Select
       * @see https://tailwindcss.com/docs/user-select
       */
      select: [{
        select: ["none", "text", "all", "auto"]
      }],
      /**
       * Will Change
       * @see https://tailwindcss.com/docs/will-change
       */
      "will-change": [{
        "will-change": ["auto", "scroll", "contents", "transform", pt, mt]
      }],
      // -----------
      // --- SVG ---
      // -----------
      /**
       * Fill
       * @see https://tailwindcss.com/docs/fill
       */
      fill: [{
        fill: ["none", ...L()]
      }],
      /**
       * Stroke Width
       * @see https://tailwindcss.com/docs/stroke-width
       */
      "stroke-w": [{
        stroke: [Ot, Ls, pa, Eb]
      }],
      /**
       * Stroke
       * @see https://tailwindcss.com/docs/stroke
       */
      stroke: [{
        stroke: ["none", ...L()]
      }],
      // ---------------------
      // --- Accessibility ---
      // ---------------------
      /**
       * Forced Color Adjust
       * @see https://tailwindcss.com/docs/forced-color-adjust
       */
      "forced-color-adjust": [{
        "forced-color-adjust": ["auto", "none"]
      }]
    },
    conflictingClassGroups: {
      "container-named": ["container-type"],
      overflow: ["overflow-x", "overflow-y"],
      overscroll: ["overscroll-x", "overscroll-y"],
      inset: ["inset-x", "inset-y", "inset-bs", "inset-be", "start", "end", "top", "right", "bottom", "left"],
      "inset-x": ["start", "end", "right", "left"],
      "inset-y": ["inset-bs", "inset-be", "top", "bottom"],
      flex: ["basis", "grow", "shrink"],
      gap: ["gap-x", "gap-y"],
      p: ["px", "py", "ps", "pe", "pbs", "pbe", "pt", "pr", "pb", "pl"],
      px: ["ps", "pe", "pr", "pl"],
      py: ["pbs", "pbe", "pt", "pb"],
      m: ["mx", "my", "ms", "me", "mbs", "mbe", "mt", "mr", "mb", "ml"],
      mx: ["ms", "me", "mr", "ml"],
      my: ["mbs", "mbe", "mt", "mb"],
      size: ["w", "h"],
      "font-size": ["leading"],
      "fvn-normal": ["fvn-ordinal", "fvn-slashed-zero", "fvn-figure", "fvn-spacing", "fvn-fraction"],
      "fvn-ordinal": ["fvn-normal"],
      "fvn-slashed-zero": ["fvn-normal"],
      "fvn-figure": ["fvn-normal"],
      "fvn-spacing": ["fvn-normal"],
      "fvn-fraction": ["fvn-normal"],
      "line-clamp": ["display", "overflow"],
      rounded: ["rounded-s", "rounded-e", "rounded-t", "rounded-r", "rounded-b", "rounded-l", "rounded-ss", "rounded-se", "rounded-ee", "rounded-es", "rounded-tl", "rounded-tr", "rounded-br", "rounded-bl"],
      "rounded-s": ["rounded-ss", "rounded-es"],
      "rounded-e": ["rounded-se", "rounded-ee"],
      "rounded-t": ["rounded-tl", "rounded-tr"],
      "rounded-r": ["rounded-tr", "rounded-br"],
      "rounded-b": ["rounded-br", "rounded-bl"],
      "rounded-l": ["rounded-tl", "rounded-bl"],
      "border-spacing": ["border-spacing-x", "border-spacing-y"],
      "border-w": ["border-w-x", "border-w-y", "border-w-s", "border-w-e", "border-w-bs", "border-w-be", "border-w-t", "border-w-r", "border-w-b", "border-w-l"],
      "border-w-x": ["border-w-s", "border-w-e", "border-w-r", "border-w-l"],
      "border-w-y": ["border-w-bs", "border-w-be", "border-w-t", "border-w-b"],
      "border-color": ["border-color-x", "border-color-y", "border-color-s", "border-color-e", "border-color-bs", "border-color-be", "border-color-t", "border-color-r", "border-color-b", "border-color-l"],
      "border-color-x": ["border-color-s", "border-color-e", "border-color-r", "border-color-l"],
      "border-color-y": ["border-color-bs", "border-color-be", "border-color-t", "border-color-b"],
      translate: ["translate-x", "translate-y", "translate-none"],
      "translate-none": ["translate", "translate-x", "translate-y", "translate-z"],
      "scroll-m": ["scroll-mx", "scroll-my", "scroll-ms", "scroll-me", "scroll-mbs", "scroll-mbe", "scroll-mt", "scroll-mr", "scroll-mb", "scroll-ml"],
      "scroll-mx": ["scroll-ms", "scroll-me", "scroll-mr", "scroll-ml"],
      "scroll-my": ["scroll-mbs", "scroll-mbe", "scroll-mt", "scroll-mb"],
      "scroll-p": ["scroll-px", "scroll-py", "scroll-ps", "scroll-pe", "scroll-pbs", "scroll-pbe", "scroll-pt", "scroll-pr", "scroll-pb", "scroll-pl"],
      "scroll-px": ["scroll-ps", "scroll-pe", "scroll-pr", "scroll-pl"],
      "scroll-py": ["scroll-pbs", "scroll-pbe", "scroll-pt", "scroll-pb"],
      touch: ["touch-x", "touch-y", "touch-pz"],
      "touch-x": ["touch"],
      "touch-y": ["touch"],
      "touch-pz": ["touch"]
    },
    conflictingClassGroupModifiers: {
      "font-size": ["leading"]
    },
    postfixLookupClassGroups: ["container-type"],
    orderSensitiveModifiers: ["*", "**", "after", "backdrop", "before", "details-content", "file", "first-letter", "first-line", "marker", "placeholder", "selection"]
  };
}, kO = /* @__PURE__ */ xO(KO);
function nm(...i) {
  return kO(MS(i));
}
const PO = nO("crm-ui-button", {
  variants: {
    variant: {
      primary: "crm-ui-button--primary",
      outline: "crm-ui-button--outline",
      ghost: "crm-ui-button--ghost"
    },
    size: {
      normal: "crm-ui-button--normal",
      icon: "crm-ui-button--icon"
    }
  },
  defaultVariants: { variant: "outline", size: "icon" }
});
function Mb({
  className: i,
  variant: a,
  size: s,
  asChild: o = !1,
  ...c
}) {
  const d = o ? FD : "button";
  return /* @__PURE__ */ q.createElement(
    d,
    {
      "data-slot": "button",
      className: nm(PO({ variant: a, size: s, className: i })),
      ...c
    }
  );
}
function GS({
  children: i,
  className: a
}) {
  const s = ah(-400), o = ah(-400), c = YD`radial-gradient(230px circle at ${s}px ${o}px, rgba(178,118,255,.88), rgba(56,180,202,.32) 58%, rgba(148,113,202,.23) 100%)`;
  return /* @__PURE__ */ q.createElement(
    Ih.div,
    {
      className: nm("crm-magic-card", a),
      style: { background: c },
      onPointerMove: (d) => {
        if (d.pointerType === "touch") return;
        const f = d.currentTarget.getBoundingClientRect();
        s.set(d.clientX - f.left), o.set(d.clientY - f.top);
      },
      onPointerLeave: () => {
        s.set(-400), o.set(-400);
      }
    },
    /* @__PURE__ */ q.createElement("div", { className: "crm-magic-card-inner" }, i)
  );
}
function JO({ children: i }) {
  return /* @__PURE__ */ q.createElement("div", { className: "crm-bento-grid" }, i);
}
function Dd({
  children: i,
  featured: a = !1
}) {
  return /* @__PURE__ */ q.createElement(GS, { className: nm("crm-bento-item", a && "crm-bento-featured") }, /* @__PURE__ */ q.createElement("div", { className: "crm-bento-content" }, i));
}
function Zr({
  children: i,
  className: a
}) {
  const s = q.useRef(null), o = QD(s, { once: !0, amount: 0.13 }), c = Fh();
  return /* @__PURE__ */ q.createElement(
    Ih.div,
    {
      ref: s,
      className: a,
      initial: c ? !1 : { opacity: 0, y: 17 },
      animate: c || o ? { opacity: 1, y: 0 } : void 0,
      transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] }
    },
    i
  );
}
const Hi = window, Ws = "/wppprospector/media/", FO = [
  {
    slug: "kanban-real.webp",
    label: "Pipeline de vendas",
    category: "KANBAN",
    alt: "Tela real de oportunidades do WppProspector com dados fictícios de QA."
  },
  {
    slug: "leads-real.webp",
    label: "Gestão de leads",
    category: "CONTATOS",
    alt: "Tela real de contatos e leads do WppProspector com dados fictícios."
  },
  {
    slug: "inteligencia-real.webp",
    label: "Motor de regras",
    category: "CONFIGURAÇÕES",
    alt: "Tela real da central de inteligência do WppProspector com dados fictícios."
  }
];
function IO() {
  const [i, a] = q.useState(!1);
  return q.useEffect(() => {
    const s = window.matchMedia("(min-width: 1024px) and (hover: hover) and (pointer: fine)"), o = () => a(s.matches);
    return o(), s.addEventListener("change", o), () => s.removeEventListener("change", o);
  }, []), i;
}
function WO() {
  var c, d;
  const i = Fh(), a = IO(), s = ((d = (c = Hi.ARTISYS_CRM_CONFIG) == null ? void 0 : c.features) == null ? void 0 : d.desktopTilt) !== !1, o = /* @__PURE__ */ q.createElement("picture", null, /* @__PURE__ */ q.createElement("source", { media: "(max-width: 640px)", type: "image/webp", srcSet: Ws + "hero-showcase-mobile-real.webp" }), /* @__PURE__ */ q.createElement(
    "img",
    {
      className: "hero-art-image",
      src: Ws + "hero-showcase-real.webp",
      width: 1600,
      height: 950,
      fetchPriority: "high",
      decoding: "async",
      alt: "Composição com prints reais do CRM: painel do WppProspector no notebook, kanban no celular e cards de leads e regras. Dados fictícios de QA."
    }
  ));
  return /* @__PURE__ */ q.createElement(
    Ih.div,
    {
      className: "crm-hero-motion",
      initial: i ? !1 : { opacity: 0.83, y: 16, scale: 0.985 },
      animate: { opacity: 1, y: 0, scale: 1 },
      transition: { duration: 1.1, ease: [0.22, 1, 0.36, 1] }
    },
    a && s && !i ? /* @__PURE__ */ q.createElement(
      hS,
      {
        className: "crm-hero-tilt",
        tiltMaxAngleX: 2.5,
        tiltMaxAngleY: 3,
        perspective: 1500,
        scale: 1,
        transitionSpeed: 1100,
        glareEnable: !1,
        gyroscope: !1
      },
      o
    ) : o
  );
}
function $O() {
  return /* @__PURE__ */ q.createElement(JO, null, /* @__PURE__ */ q.createElement(Zr, { className: "crm-bento-area crm-bento-area--featured" }, /* @__PURE__ */ q.createElement(Dd, { featured: !0 }, /* @__PURE__ */ q.createElement("span", { className: "status status-core" }, "Sem conexão obrigatória"), /* @__PURE__ */ q.createElement("h3", null, "CRM manual"), /* @__PURE__ */ q.createElement("p", null, "Seus leads e vendas organizados, sem WhatsApp ou IA."), /* @__PURE__ */ q.createElement(
    "img",
    {
      src: Ws + "kanban-real.webp",
      width: 670,
      height: 360,
      loading: "lazy",
      decoding: "async",
      alt: "Pipeline real do CRM, demonstrado com dados fictícios."
    }
  ))), /* @__PURE__ */ q.createElement(Zr, { className: "crm-bento-area crm-bento-area--small" }, /* @__PURE__ */ q.createElement(Dd, null, /* @__PURE__ */ q.createElement("span", { className: "status" }, "QR Code"), /* @__PURE__ */ q.createElement("h3", null, "WhatsApp local"), /* @__PURE__ */ q.createElement("p", null, "Baileys open source. Conexão não oficial e opcional."))), /* @__PURE__ */ q.createElement(Zr, { className: "crm-bento-area crm-bento-area--small" }, /* @__PURE__ */ q.createElement(Dd, null, /* @__PURE__ */ q.createElement("span", { className: "status" }, "Meta API"), /* @__PURE__ */ q.createElement("h3", null, "Canal oficial"), /* @__PURE__ */ q.createElement("p", null, "Integração opcional; tarifas externas podem se aplicar."))));
}
function t3() {
  const i = Fh(), [a, s] = dh({
    align: "start",
    containScroll: "trimSnaps",
    loop: !1,
    dragFree: !1,
    duration: i ? 12 : 24
  }), [o, c] = q.useState(!1), [d, f] = q.useState(!1), h = document.getElementById("crm-gallery-controls"), p = q.useCallback(() => {
    s && (c(s.canScrollPrev()), f(s.canScrollNext()));
  }, [s]);
  return q.useEffect(() => {
    if (!s) return;
    const g = () => {
      var v;
      p(), (v = Hi.__artisysCRMTrack) == null || v.call(Hi, "crm_gallery_slide", { slide: s.selectedScrollSnap() + 1 });
    };
    return p(), s.on("select", g), s.on("reInit", p), () => {
      s.off("select", g), s.off("reInit", p);
    };
  }, [s, p]), q.useEffect(() => {
    if (h)
      return h.classList.add("crm-react-controls"), () => h.classList.remove("crm-react-controls");
  }, [h]), /* @__PURE__ */ q.createElement(q.Fragment, null, /* @__PURE__ */ q.createElement("div", { className: "crm-embla-viewport", ref: a, "aria-label": "Capturas reais das funcionalidades do CRM" }, /* @__PURE__ */ q.createElement("div", { className: "crm-embla-container" }, FO.map((g, v) => /* @__PURE__ */ q.createElement(Zr, { className: "crm-embla-slide", key: g.slug }, /* @__PURE__ */ q.createElement(GS, { className: "crm-real-shot" }, /* @__PURE__ */ q.createElement(
    "a",
    {
      className: "shot-card",
      href: Ws + g.slug,
      target: "_blank",
      rel: "noopener noreferrer",
      "aria-label": `Abrir print real: ${g.label}`,
      onClick: () => {
        var y;
        return (y = Hi.__artisysCRMTrack) == null ? void 0 : y.call(Hi, "crm_screenshot_open", { screen: g.category });
      }
    },
    /* @__PURE__ */ q.createElement("div", { className: "shot-image" }, /* @__PURE__ */ q.createElement(
      "img",
      {
        src: Ws + g.slug,
        width: 1440,
        height: 900,
        loading: "lazy",
        decoding: "async",
        alt: g.alt
      }
    )),
    /* @__PURE__ */ q.createElement("div", { className: "shot-caption" }, /* @__PURE__ */ q.createElement("strong", null, g.label), /* @__PURE__ */ q.createElement("span", null, String(v + 1).padStart(2, "0"), " / ", g.category))
  )))))), h && qA.createPortal(
    /* @__PURE__ */ q.createElement("div", { className: "crm-embla-controls" }, /* @__PURE__ */ q.createElement(
      Mb,
      {
        variant: "outline",
        size: "icon",
        type: "button",
        "aria-label": "Ver captura anterior",
        onClick: () => s == null ? void 0 : s.scrollPrev(),
        disabled: !o
      },
      "←"
    ), /* @__PURE__ */ q.createElement(
      Mb,
      {
        variant: "outline",
        size: "icon",
        type: "button",
        "aria-label": "Ver próxima captura",
        onClick: () => s == null ? void 0 : s.scrollNext(),
        disabled: !d
      },
      "→"
    )),
    h
  ));
}
function e3() {
  const i = document.getElementById("crm-hero-visual");
  i && ad.createRoot(i).render(/* @__PURE__ */ q.createElement(WO, null));
  const a = document.getElementById("galeria");
  a && (a.classList.add("crm-gallery-enhanced"), ad.createRoot(a).render(/* @__PURE__ */ q.createElement(t3, null)));
  const s = document.getElementById("crm-connection-bento");
  s && (s.classList.add("crm-bento-enhanced"), ad.createRoot(s).render(/* @__PURE__ */ q.createElement($O, null)));
}
async function n3() {
  var o, c;
  if (((c = (o = Hi.ARTISYS_CRM_CONFIG) == null ? void 0 : o.features) == null ? void 0 : c.desktopSmoothScroll) !== !0 || !window.matchMedia("(min-width: 1200px) and (hover: hover) and (pointer: fine)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const { default: a } = await import("./lenis-C4zAXXrI.js"), s = new a({ autoRaf: !0, anchors: !0, smoothWheel: !0, syncTouch: !1 });
  window.addEventListener("pagehide", () => s.destroy(), { once: !0 });
}
e3();
n3().catch((i) => {
  console.warn("CRM optional smooth scroll not initialized", i);
});
