import test from 'node:test';
import assert from 'node:assert/strict';
import {createControlTapDetector} from './showcase-shortcut.js';
function setup(){let count=0,time=0;const detector=createControlTapDetector(()=>count++,()=>time);return {detector,clock:t=>time=t,count:()=>count,tap(){detector.keydown({key:'Control'});detector.keyup({key:'Control'});}};}
test('two plain Ctrl taps reveal the shortcut once',()=>{const s=setup();s.tap();assert.equal(s.count(),0);s.clock(300);s.tap();assert.equal(s.count(),1);s.clock(400);s.tap();assert.equal(s.count(),1);});
test('slow taps and held key repeat do not reveal the shortcut',()=>{const s=setup();s.tap();s.clock(651);s.tap();assert.equal(s.count(),0);s.detector.keydown({key:'Control'});s.detector.keydown({key:'Control',repeat:true});s.detector.keydown({key:'Control',repeat:true});assert.equal(s.count(),0);});
test('Ctrl combinations and window blur clear the tap sequence',()=>{const s=setup();s.tap();s.clock(200);s.detector.keydown({key:'Control'});s.detector.keydown({key:'c',ctrlKey:true});s.detector.keyup({key:'Control'});s.tap();assert.equal(s.count(),0);s.detector.reset();s.tap();assert.equal(s.count(),0);});
