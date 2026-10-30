// helper: synthetic flick dispatched with busy-wait timing inside the page
module.exports.flick = async (page, { dist = 150, curve = 0, ms = 120, angle = 0 } = {}) => {
  return page.evaluate(({ dist, curve, ms, angle }) => {
    const v = __bb.ball.mesh.position.clone(); __bb.lane.localToWorld(v); v.project(__bb.camera);
    const x = (v.x+1)/2*innerWidth, y = (1-v.y)/2*innerHeight;
    const a = __bb.laneToWorld(0,0), b = __bb.laneToWorld(0,-1); a.project(__bb.camera); b.project(__bb.camera);
    let dx=(b.x-a.x)*innerWidth/2, dy=-(b.y-a.y)*innerHeight/2; const l=Math.hypot(dx,dy); dx/=l; dy/=l;
    const ca = Math.cos(angle), sa = Math.sin(angle); const fx = dx*ca - dy*sa, fy = dx*sa + dy*ca;
    const c = document.getElementById('c');
    const fire = (type, px, py) => c.dispatchEvent(new PointerEvent(type, { pointerId: 7, clientX: px, clientY: py, bubbles: true, isPrimary: true, pointerType: 'touch' }));
    fire('pointerdown', x, y);
    const steps = 12, t0 = performance.now();
    for (let i = 1; i <= steps; i++) {
      while (performance.now() < t0 + i * ms / steps) {}
      const k = i / steps, d = dist * k, perp = curve * k * k;
      fire('pointermove', x + fx*d - fy*perp, y + fy*d + fx*perp);
    }
    fire('pointerup', x + fx*dist - fy*curve, y + fy*dist + fx*curve);
    return [__bb.ball.inWorld, __bb.ball.spin, __bb.ball.body.velocity.x, __bb.ball.body.velocity.z];
  }, { dist, curve, ms, angle });
};
