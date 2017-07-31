LD39 - Running out of Power - Drone Supervisor
==============================================

TODO:
* sounds

Want:
* auto start tutorial if you have no saved scores
* art polish:
  * base, crafting - look more unique/obvious?
  * background slightly more interesting
  * display money on center of base?
  * brighter colors?
* Build:
  * transfer
  * rotate? (as two more "directions" on arrows?)

Balance so far:
* Earliest crafting I was able to do was turn 10 (not enough power upgrades)
  * Maybe power upgrade gives +2 power?  Probably not exponential, but linear?
  * Maybe crafted stuff should be much more valuable?

UI:
* mousewheel to change direction
* in preview: pause, rewind, etc
* tooltips on resources, show immediate recipes
  * same when running with resources being carried

Level:
  * (Random?) resource distribution
  * Ship/Base in center

Game loop:
  * Setup
    * Place nodes
    * Buy upgrades (can undo anything back to previous loop)
    * Preview
  * Execute, gain resources, consume time

Goal (in fewest loops):
  * Total resource amount
  * Visible node off-screen you want to get to? (Requires total resource amount for appropriate upgrades, though clever layout could do it cheaper?)
  * Particular recipe?

Primary limiting resource:
* # of drones?
* placement radius?
* creep generators?
* drone max power (effectively useful radius!)
Polish:
  * Score for beating, high score list

Placed Nodes:
* drones
  * normal
  * fast drone
* direction
* relative turn (left/right/u-turn)
* crafter
  * 2-input
  * 3-input
  * 5-input
* transfer

Generated nodes:
* resources
* obstacles?
  * blocking obstacles - drones just stop
  * death obstacles - drones fall in, die, generate negative income


Engine tweaks:
  * Move view_origin into a camera module, have input and draw_list respect it
