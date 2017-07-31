Ludum Dare 39 - Running out of Power - Drone Supervisor
======================================================

http://www.dashingstrike.com/LudumDare/LD39/

Give orders to an army of drones in this turn-based production-line building simulation game!

Just follow the tutorial and you should be good to go!

Things you might not get from the tutorial (come back and read this after playing the tutorial, perhaps):
* On later levels, can pan the level by clicking and dragging, or holding the space bar
* Resource generators generate a specific quantity of resources (e.g. copper generates 4), and you can harvest from them multiple times

--
_Spry Fox_'s _Leap Day_ (no longer available, sadly) was a big inspiration for this.

Near the end, I decided that adding a tutorial was more useful than adding sounds and another polish pass, so, sadly, this game has no sound :(.  Hope the tutorial helps you get into the game!


Development notes
=================

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
