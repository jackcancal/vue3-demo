
//原始=>响应式
let toProxy = new WeakMap;
//响应式=>原始
let toRaw = new WeakMap;
let effectStack = []
let targetMap = new WeakMap;
// 收集依赖
function track(target, key) {
  const effect = effectStack[effectStack.length-1]
  if (effect){
    let depMap = targetMap.get(target)
    if (!depMap){
      depMap = new Map;
      targetMap.set(target, depMap)
    }
    let dep = depMap.get(key)
    if (!dep){
      dep = new Set;
      depMap.set(key,dep)
    }
    if (!dep.has(effect)){
      dep.add(effect)
      effect.deps.push(dep)
    }
  }
}
// 触发依赖
function trigger(target,key,info) {
  const depMap = targetMap.get(target);
  if (!depMap) {
    return
  }
  const effects = new Set;
  const computedRunners = new Set

  if (key){
    let deps = depMap.get(key)
    deps.forEach(effect=>{
      if (effect.computed){
        computedRunners.add(effect)
      }else {
        effects.add(effect)
      }
    })
  }
  effects.forEach(effect=>{
    effect()
  })
  computedRunners.forEach(computed=>computed())
}
// 通知
function effect(fn, options = {}) {
  let e = createReactiveEffect(fn, options)
  if (!options.lazy) e()
  return e;
}
function createReactiveEffect(fn, options) {
  // 构造effect
  const effect = function effect(...args) {
    return run(effect, fn, args)
  }
  effect.deps = [];
  effect.computed = options.computed;
  effect.lazy = options.lazy;
  return effect;
}

function run(effect, fn, args) {
  if (effectStack.indexOf(effect)===-1){
    try {
      effectStack.push(effect)
      return fn(...args)
    }finally {
      effectStack.pop()
    }
  }
}
//响应式代理
const baseHandler = {
  get(target, key){
   //收集依赖
    track(target, key)
    const res = Reflect.get(target, key)
    return typeof res === 'object' ? reactive(res) : res
  },
  set(target, key, val){
    const res = Reflect.set(target,key,val)
    // 触发更新
    trigger(target,key,{oldValue:target[key],newValue:val})
    return res
  }
}
//响应式
function reactive(target) {
  // 查询缓存
  let observed = toProxy.get(target)
  if (observed) return observed;
  if (toRaw.get(target)) return target;
  observed = new Proxy(target, baseHandler);
  //  设置缓存
  toProxy.set(target, observed)
  toRaw.set(observed, target)
  return observed
}

function computed(fn) {
  //特殊的effect
  const runner = effect(fn,{computed:true,lazy:true})
  return {
    effect: runner,
    get value(){
      return runner()
    }
  }
}