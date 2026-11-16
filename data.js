const gameList = [
    {
        "name": "1",
        "file": "Games/cl1.html",
        "thumb": "Game Images/1.png",
        "description": "Start with high-numbered tiles and work your way down to 1. Sliding the board moves every tile at once. Two matching tiles combine into a tile worth half as much. Keep matching numbers near each other so you have room to maneuver as the board fills up.\n\nControls\nUse the arrow keys to slide all the tiles."
    },
    {
        "name": "Grindcraft",
        "file": "Games/clgrindcraft.html",
        "thumb": "Game Images/GC.png",
        "description": "Start by harvesting wood and other basic materials, then turn them into tools, workstations, and buildings. Crafting better tools opens up new resources, and trained workers can gather for you. Build up a steady supply of materials before spending everything on a major recipe.\n\nControls\nClick resource icons to gather and recipe icons to craft. Hover over an item to check its ingredients."
    },
    {
        "name": "A Dance Of Fire And Ice",
        "file": "Games/clADOFAI.html",
        "thumb": "Game Images/ADOFI.png",
        "description": "Guide two orbiting spheres along a track by stepping onto each tile on the beat. Corners change the timing between taps, so listen for the rhythm and watch the shape of the path. Replaying a tricky stretch can help you hear where its rhythm changes.\n\nControls\nTap a keyboard key or click on each beat to advance. Use the calibration option if the audio and inputs feel out of sync."
    },
    {
        "name": "10 Minutes Till Dawn",
        "file": "Games/cl10minutestildawn.html",
        "thumb": "Game Images/10mtd.png",
        "description": "Survive ten minutes against waves of monsters. Pick up the experience they drop, then choose upgrades that change your shots, summon allies, or give you more ways to clear the crowd. Leave yourself an exit before circling back for experience.\n\nControls\nMove with WASD, aim with the mouse, and hold left click to fire. Press R to reload."
    },
    {
        "name": "12 Mini Battles",
        "file": "Games/cl12minibattles.html",
        "thumb": "Game Images/12-minibattles.png",
        "description": "Share a keyboard and face a friend in bite-sized duels that swap the rules every round. One round might be a soccer match while the next is a quick-draw contest. Watch what your character does before you commit, since the same button has a new job in each minigame.\n\nControls\nPlayer 1 uses A. Player 2 uses L."
    },
    {
        "name": "Adventure Capitalist",
        "file": "Games/clAdventureCapatalist.html",
        "thumb": "Game Images/AdventureCapitalist.png",
        "description": "Start with a lemonade stand and reinvest its earnings in larger businesses. Hire managers to automate each business, then buy upgrades to boost revenue. Balance adding new businesses with upgrading the ones already bringing in money.\n\nControls\nClick business icons to start a payout. Use the Buy, Managers, and Upgrades buttons to spend earnings."
    },
    {
        "name": "Babel Tower",
        "file": "Games/clbabeltower.html",
        "thumb": "Game Images/Babel.png",
        "description": "Build a tower one floor at a time by mining stone, processing bricks, and moving materials to the construction site. As the tower grows, upgrades speed up the workers and the stages of production. Watch for whichever step is holding up the next floor.\n\nControls\nClick and hold work areas to speed up tasks. Click shop and upgrade buttons to spend money on production."
    },
    {
        "name": "Bacon May Die",
        "file": "Games/clbaconmaydie.html",
        "thumb": "Game Images/BaconMayDie.png",
        "description": "Fight off waves of enemies as a pig armed with melee weapons and ranged attacks. Swap between close-range strikes and shots as the crowd shifts around you. Keep moving so enemies have less time to close in from both sides.\n\nControls\nPlayer 1 uses the arrow keys to move and fight and holds Left or Right to shoot. In co-op, Player 2 uses WASD and holds A or D to shoot."
    },
    {
        "name": "Big Ice Tower Tiny Square",
        "file": "Games/clbigicetowertinysquare.html",
        "thumb": "Game Images/bitts.png",
        "description": "Climb an icy tower to rescue your pineapple. Slippery platforms carry your momentum farther than you might expect, so brake early near spikes and give yourself room to line up jumps. Checkpoints let you practice the hardest sections in short bursts.\n\nControls\nUse Left and Right to move and Up or Space to jump."
    },
    {
        "name": "Big Neon Tower Tiny Square",
        "file": "Games/clbigneontowertinysquare.html",
        "thumb": "Game Images/bntts.png",
        "description": "Climb a neon-lit tower filled with hazards and narrow landings as you work your way back to your pineapple. Watch the timing of moving obstacles before jumping, then use checkpoints to practice one section at a time.\n\nControls\nUse Left and Right to move and Up or Space to jump."
    },
    {
        "name": "Big Tower Tiny Square 2",
        "file": "Games/clbtts2.html",
        "thumb": "Game Images/Big Tower Tiny Square 2.png",
        "description": "Guide a tiny square through another tower full of moving platforms, spikes, and tight gaps. The climb is broken up by checkpoints, so take a moment to read each room and figure out where the next safe landing is before jumping.\n\nControls\nUse Left and Right to move and Up or Space to jump."
    },
    {
        "name": "Volley Random",
        "file": "Games/clvolleyrandom.html",
        "thumb": "Game Images/VolleyRandom.png",
        "description": "Keep the ball from touching your side of the court in a volleyball match with wobbly players. Conditions can change after a point, so watch how the ball and your team move each round. A well-timed jump can cover both a return and an attack.\n\nControls\nUse W to jump as Player 1 and Up Arrow as Player 2. In solo play, use W."
    },
    {
        "name": "Vex X3M",
        "file": "Games/clvexx3m.html",
        "thumb": "Game Images/vx3m.png",
        "description": "Take a stunt bike through Vex obstacle courses filled with spikes, moving platforms, and tricky landings. Balance your bike in the air and clear each checkpoint on the way to the finish. Ease off the throttle before a bad landing so you have time to straighten the bike.\n\nControls\nUse Up or W to accelerate, Down or S to brake or reverse, and Left/Right or A/D to lean."
    },
    {
        "name": "Basket Random",
        "file": "Games/clbasketrandom.html",
        "thumb": "Game Images/BasketRandom.png",
        "description": "Control a wobbly basketball team and try to land the ball in the other hoop. The court, ball, and players can change between points. Watch where the ball is headed before jumping so your whole team is in a position to rebound or shoot.\n\nControls\nPlayer 1 uses W. Player 2 uses Up Arrow. In solo play, use W. The same button makes your team jump and can trigger a shot."
    },
    {
        "name": "Boxing Random",
        "file": "Games/clboxingrandom.html",
        "thumb": "Game Images/Br.png",
        "description": "Time your jumps and swings to land a clean hit on your opponent's head. The ring and fighters can change from round to round, so watch their reach before rushing in. A single well-timed hit can decide a round.\n\nControls\nPlayer 1 uses W. Player 2 uses Up Arrow. In solo play, use W. Press your key to jump and punch."
    },
    {
        "name": "Bob The Robber 5",
        "file": "Games/clbobtherobber5.html",
        "thumb": "Game Images/btr5.png",
        "description": "Explore a temple as Bob, sneaking past guards and traps while gathering treasure. Use shadows and pauses in patrol routes to stay out of sight, and check rooms for hidden loot and objects you can interact with before moving on.\n\nControls\nUse Left and Right to move and Up to interact. Follow the prompts when picking a lock or handling a device."
    },
    {
        "name": "Bob The Robber 2",
        "file": "Games/clbobtherobber2.html",
        "thumb": "Game Images/btr2.png",
        "description": "Guide Bob through buildings full of cameras, guards, and alarms. Search rooms for valuables and clues, hide in dark spots while patrols pass, and find a way past each security setup before heading for the exit.\n\nControls\nUse Left and Right to move, Up to interact with doors and objects, and Space to swing your club."
    },
    {
        "name": "Cluster Rush",
        "file": "Games/clclusterrush.html",
        "thumb": "Game Images/CR.png",
        "description": "Jump between the roofs of speeding trucks as the convoy swerves and crashes. Look ahead for the next stable landing, and grab onto a truck's side if you come up short. Reach the finish without touching the ground.\n\nControls\nUse Left and Right to steer. Press Space or J to jump, and hold the jump key against a truck to climb."
    },
    {
        "name": "Circloo 2",
        "file": "Games/clCircloO2.html",
        "thumb": "Game Images/circloo2.png",
        "description": "Roll a small ball through a circular level, collecting white rings that expand the course as you go. Ramps, ropes, and moving objects change how you carry speed. Roll backward for a longer run-up when a ledge looks too high to reach.\n\nControls\nHold Left or Right to roll. Build speed on slopes to launch across gaps."
    },
    {
        "name": "Cookie Clicker",
        "file": "Games/clcookie-clicker.html",
        "thumb": "Game Images/CookieClicker.png",
        "description": "Bake cookies by clicking the giant cookie, then buy cursors, grandmas, and other buildings that keep production running. Upgrades increase what you earn per click or per second. Watch for golden cookies while you decide what to buy next.\n\nControls\nClick the giant cookie to bake. Click buildings or upgrades in the store to buy them, and click golden cookies when they appear."
    },
    {
        "name": "Crossy Road",
        "file": "Games/clcrossyroad.html",
        "thumb": "Game Images/Crossy Road.png",
        "description": "Hop through traffic, across tracks, and along floating logs to see how far you can get. Read each lane before moving and account for logs drifting sideways. The camera pushes forward if you wait too long, so take short pauses and keep moving.\n\nControls\nUse the arrow keys to hop one tile in the chosen direction."
    },
    {
        "name": "ULTRAKILL",
        "file": "Games/ULTRAKILL.html",
        "thumb": "Game Images/ULTRAKILL.png",
        "description": "Fight through arenas at high speed, swapping weapons and chaining movement to build your style score. Getting close to enemies lets you recover health from fresh blood. Keep moving between targets and use the room's height and cover to create openings.\n\nControls\nUse WASD to move, mouse to aim and fire, Space to jump, Shift to dash, Ctrl to slide, and F to punch. Use number keys to swap weapons."
    },
    {
        "name": "TAG",
        "file": "Games/cltagcm.html",
        "thumb": "Game Images/TAG.png",
        "description": "Play a local game of tag and try to avoid being the one who is It when the round ends. Cut across platforms and use shortcuts to stay out of reach. If you're It, anticipate where someone is about to land instead of following every jump they make.\n\nControls\nUse WASD for Player 1, TFGH for Player 2, IJKL for Player 3, and the arrow keys for Player 4. Your set handles movement and jumping."
    },
    {
        "name": "Half Life",
        "file": "Games/clhalflife.html",
        "thumb": "Game Images/HL.png",
        "description": "Play as Gordon Freeman and find a way out of the Black Mesa research facility after an experiment goes wrong. Explore labs and maintenance areas, solve environmental puzzles, and make your supplies last through encounters with aliens and soldiers.\n\nControls\nUse WASD to move, the mouse to look and fire, Space to jump, Ctrl to crouch, E to use objects, and R to reload."
    },
    {
        "name": "Cs:Go Clicker",
        "file": "Games/clcsgoclicker.html",
        "thumb": "Game Images/csgoclicker.png",
        "description": "Open weapon cases, collect skins, and turn surplus items into cash for more rolls and upgrades. Decide when to keep a rare find and when to sell items so you can afford the next case. The inventory helps you keep track of what you've collected.\n\nControls\nClick case, inventory, and shop buttons with the mouse. Select items in the inventory to keep or sell them."
    },
    {
        "name": "Minecraft 1.9.4",
        "file": "Games/clEaglercraftL_19_v0_7_0_Offline_Signed.html",
        "thumb": "Game Images/mc.png",
        "description": "Explore, mine, and build in the browser version of Minecraft 1.9.4. Gather materials and make shelter in Survival, or build freely in Creative. In combat, watch the attack cooldown and give heavier swings time to recharge.\n\nControls\nUse WASD to move, the mouse to look, Space to jump, Shift to sneak, and E for inventory. Left-click to mine or attack and right-click to place or use."
    },
    {
        "name": "Block The Pig",
        "file": "Games/clblockthepig.html",
        "thumb": "Game Images/blockthepig.png",
        "description": "Place blocks on a hexagonal board to stop a pig from reaching an open edge. The pig moves after each placement, so seal off the widest routes first and try to guide it into a smaller pocket where you can close the remaining gaps.\n\nControls\nClick an empty hexagon to place a block. You get one placement per turn after the pig starts moving."
    },
    {
        "name": "Deadly Descent",
        "file": "Games/cldeadlydescent.html",
        "thumb": "Game Images/Deadly Descent.png",
        "description": "Drive down steep mountain courses full of rocks, narrow ledges, and sharp drops. Keep the car under control long enough to reach the finish. Brake before tight turns and ease back onto the accelerator once the wheels are pointed down the track.\n\nControls\nUse WASD or the arrow keys to drive and steer. Space operates the handbrake."
    },
    {
        "name": "Doge Miner",
        "file": "Games/cldogeminer.html",
        "thumb": "Game Images/DM.png",
        "description": "Help Doge mine enough Dogecoin for a mission to the Moon. Start by clicking to mine, then hire helpers and buy upgrades to earn coins automatically. Early upgrades that raise your steady income make the bigger purchases easier to reach.\n\nControls\nClick Doge's mining area to earn coins. Click helpers and upgrades in the shop to buy them."
    },
    {
        "name": "Doge Miner 2",
        "file": "Games/cldogeminer2.html",
        "thumb": "Game Images/DM2.png",
        "description": "Mine Dogecoin, recruit helpers, and collect gear as you work toward launching into space. New locations bring more upgrades and things to discover. Spend some coins on steady production so you can afford equipment and larger goals sooner.\n\nControls\nClick the mining target to gather coins. Use the shop, equipment, and travel buttons to manage upgrades and destinations."
    },
    {
        "name": "Drift Boss",
        "file": "Games/cldriftboss.html",
        "thumb": "Game Images/DB.png",
        "description": "Follow a twisting track with no guardrails using a single control. Hold to turn one way and let go to turn back. Watch the next bend so you can begin the turn before the car reaches the edge, especially on short sections between corners.\n\nControls\nHold left click or Space to steer right. Release to steer left."
    },
    {
        "name": "Granny",
        "file": "Games/clgrannyy.html",
        "thumb": "Game Images/Granny.png",
        "description": "Search Granny's house for tools and keys and piece together an escape before your days run out. Granny hears objects hit the floor, so pay attention to where you leave items. Find a bed or wardrobe to hide in before you make a noisy move.\n\nControls\nUse WASD to move, mouse to look, E to interact, C to crouch, and Space to drop the item you're holding."
    },
    {
        "name": "Gun Spin",
        "file": "Games/clgun-spin.html",
        "thumb": "Game Images/Gunspin.png",
        "description": "Use a gun's recoil to propel it as far downrange as you can. Each shot pushes the gun the opposite way from where the barrel points. Time your remaining shots to stay in the air and reach a longer distance, then use your earnings for upgrades.\n\nControls\nClick to fire. Watch the barrel rotate and fire when the recoil pushes you toward the right."
    },
    {
        "name": "Idle Dice",
        "file": "Games/clidledice.html",
        "thumb": "Game Images/Idle Dice.png",
        "description": "Roll dice for points, level up your dice, and build multipliers with playing cards. Combinations make later rolls much more valuable. When progress slows, prestige to trade the current run for a bonus that speeds up the next one.\n\nControls\nClick Roll to throw the dice. Use the upgrade, card, and prestige buttons to manage progression."
    },
    {
        "name": "DreadHead Parkour",
        "file": "Games/cldreadheadparkour.html",
        "thumb": "Game Images/DHP.png",
        "description": "Run through obstacle courses full of spikes, saws, and drops while grabbing coins on the way to the finish. Jump across gaps and slide under low traps. Slow down near blind drops so you can see where you need to land.\n\nControls\nUse A and D to move, W to jump, and S to slide."
    },
    {
        "name": "We Become What We Behold",
        "file": "Games/clwebecomewhatwebehold.html",
        "thumb": "Game Images/WBWWB.png",
        "description": "Point a news camera at a crowd and watch people react to what you put on the screen. The story changes as certain moments get more attention and begin to influence the crowd. Try following different characters when you're deciding what to photograph.\n\nControls\nMove the mouse to aim the camera and left-click to take a picture."
    },
    {
        "name": "Vex3",
        "file": "Games/clvex3.html",
        "thumb": "Game Images/Vex3.png",
        "description": "Run, jump, and climb through stick-figure obstacle courses with spikes, saws, and moving platforms. Touch checkpoints as you go so a mistake sends you back to the last safe spot. Use wall jumps to reach higher ledges and slides to get through tight spaces.\n\nControls\nUse WASD or the arrow keys to move and jump. Press Down or S while running to slide."
    },
    {
        "name": "Ragdoll Archers",
        "file": "Games/clragdollarchers.html",
        "thumb": "Game Images/RagdollArchers.png",
        "description": "Aim arrows at opponents while gravity and your archer's balance affect each shot. Pick up apples to recover and keep an eye on stamina during longer fights. Try a higher arc when a straight shot can't reach the target.\n\nControls\nIn solo play, use the mouse to aim and shoot and Space to jump. In two-player modes, use WASD and Left Shift for Player 1 or the arrow keys and Right Shift for Player 2."
    },
    {
        "name": "Rooftop Snipers",
        "file": "Games/clrooftopsnipers.html",
        "thumb": "Game Images/RooftopSnipers.png",
        "description": "Knock your opponent off a rooftop with well-timed shots. Your character wobbles and recoils after firing, so jumping can dodge a shot but may also carry you close to the edge. Watch your opponent's aim before committing to a jump.\n\nControls\nPlayer 1 uses W to jump and E to shoot. Player 2 uses I to jump and O to shoot."
    },
    {
        "name": "Rooftop Snipers 2",
        "file": "Games/clrooftopsnipers2.html",
        "thumb": "Game Images/RooftopSnipers2.png",
        "description": "Take on quick rooftop duels where position and recoil matter as much as aim. Knock the other fighter off the building to score a point. Try shooting as they land near an edge, where a small hit can end the round.\n\nControls\nPlayer 1 uses W to jump and E to aim and fire. Player 2 uses I to jump and O to aim and fire."
    },
    {
        "name": "MotoX3m 2",
        "file": "Games/clmotox3m2.html",
        "thumb": "Game Images/Motox3m2.png",
        "description": "Race a dirt bike through timed obstacle courses filled with steep ramps and unexpected hazards. Pull off flips where there's enough airtime, then get both wheels lined up before landing. Checkpoints let you recover from a crash and finish the course.\n\nControls\nUse Up to accelerate, Down to brake, and Left or Right to lean and rotate the bike."
    },
    {
        "name": "MotoX3m 3",
        "file": "Games/clmotox3m3.html",
        "thumb": "Game Images/Motox3m3.png",
        "description": "Guide your bike through a new set of stunt tracks with moving hazards, ramps, and narrow surfaces. Race the clock, but leave time to straighten up before each landing. A clean run is often faster than trying to fit a flip into every jump.\n\nControls\nUse the arrow keys or WASD to accelerate, brake, and tilt the bike forward or backward."
    },
    {
        "name": "MotoX3m",
        "file": "Games/clmotox3mm.html",
        "thumb": "Game Images/Motox3m.png",
        "description": "Race through short dirt-bike courses packed with ramps, spikes, and moving obstacles. Reach the finish quickly to earn stars, and use safe jumps to pull off flips that shave time from your run. Aim to land level so you can carry speed into the next section.\n\nControls\nUse Up to accelerate, Down to brake, and Left or Right to tilt the bike in the air."
    },
    {
        "name": "Mr.Mine",
        "file": "Games/clmrmine.html",
        "thumb": "Game Images/MrMine.png",
        "description": "Run a mine that digs deeper over time. Sell minerals to fund workers and drill upgrades, then discover new layers with different resources and events. Check drill requirements before selling everything, since upcoming upgrades can need specific materials.\n\nControls\nClick workers, the drill, the sell center, and other buildings to open their menus. Use the mine view to scroll between depths."
    },
    {
        "name": "Run 3",
        "file": "Games/clrun3.html",
        "thumb": "Game Images/Run3.png",
        "description": "Run through a network of tunnels in space while avoiding missing tiles. Stepping onto a side wall turns it into the floor, which opens routes around gaps. In Explore Mode, follow branching paths to discover new stages and runners.\n\nControls\nUse Left and Right to steer and Space or Up to jump."
    },
    {
        "name": "Baldi's Basics",
        "file": "Games/clbaldisbasics.html",
        "thumb": "Game Images/Baldi.png",
        "description": "Collect seven notebooks and look for a way out of a school full of characters who can slow you down. Baldi follows sounds, and other characters can interfere with your route. Save stamina for emergencies and learn side hallways before the chase speeds up.\n\nControls\nUse WASD to move, the mouse to look, and Shift to run. Left-click objects or doors to interact and right-click to use the selected item."
    },
    {
        "name": "Capybara Clicker",
        "file": "Games/clcapybaraclicker.html",
        "thumb": "Game Images/CapybaraClicker.png",
        "description": "Tap a capybara to grow your population, then spend it on upgrades that boost each click or generate more capybaras automatically. As your total rises, you can unlock different looks. Balance click power with passive growth depending on how actively you want to play.\n\nControls\nClick the capybara to earn more. Click upgrades and customization options in the menus."
    },
    {
        "name": "Minecraft 1.11.2",
        "file": "Games/clEaglercraftZ_1112.html",
        "thumb": "Game Images/mc1.11.2.png",
        "description": "Build, craft, or explore in Minecraft 1.11.2 through Eaglercraft. Start a Survival world and gather enough supplies to settle in, or use Creative to build freely. This version includes Woodland Mansions and shulker boxes to discover or build around.\n\nControls\nUse WASD to move, mouse to look, Space to jump, Shift to sneak, and E for inventory. Left-click to mine or attack and right-click to place or use."
    },
    {
        "name": "Minecraft 1.12.2",
        "file": "Games/Eaglercraft1.12.html",
        "thumb": "Game Images/mc1.12.2.png",
        "description": "Play the World of Color era of Minecraft in your browser. Explore and craft in Survival or take advantage of concrete, glazed terracotta, and other colorful materials in Creative builds. Keep a bed and spare tools handy if you travel far from home.\n\nControls\nUse WASD to move, mouse to look, Space to jump, Shift to sneak, and E for inventory. Left-click to mine or attack and right-click to place or use."
    },
    {
        "name": "Just One Boss",
        "file": "Games/cljustoneboss.html",
        "thumb": "Game Images/job.png",
        "description": "Fight one boss that keeps changing the rules. Move across the grid to collect glowing tiles and damage the boss while dodging incoming attacks. Learn the route through each pattern so you're in position when the next tile appears.\n\nControls\nUse the arrow keys to move. Step onto glowing tiles to attack."
    },
    {
        "name": "Five Nights At Freddy's 1",
        "file": "Games/clFNAF.html",
        "thumb": "Game Images/Fnaf.png",
        "description": "Work the night shift at Freddy Fazbear's Pizza and stay in your office until 6 AM. Check the cameras to track the animatronics and use lights and doors when they get close. Every device uses power, so short checks leave you more power for the end of the night.\n\nControls\nMove the mouse to look around the office and raise or lower the monitor. Click camera feeds, door buttons, and light switches."
    },
    {
        "name": "Five Nights At Freddy's 2",
        "file": "Games/clFNAF2.html",
        "thumb": "Game Images/Fnaf2.png",
        "description": "Survive a night shift in a Freddy's location with open hallways and vents. Use the Freddy mask to fool some animatronics, flash the hallway light when needed, and keep the music box wound. Plan camera checks around the music box so it never runs down unnoticed.\n\nControls\nUse the mouse to open the camera monitor or mask and click camera and vent controls. Use the hallway flashlight and hold the wind-up button on the Prize Corner feed."
    },
    {
        "name": "Five Nights At Freddy's 3",
        "file": "Games/clFNAF3.html",
        "thumb": "Game Images/Fnaf3.png",
        "description": "Monitor a horror attraction while Springtrap moves through the building and phantom encounters disrupt your systems. Use audio cues to lure Springtrap away, seal a vent to block a shortcut, and reboot equipment when it goes down. Check which system has failed before spending time on a full reboot.\n\nControls\nUse the mouse to switch cameras, play audio, seal vents on the vent map, and reboot systems on the maintenance panel."
    },
    {
        "name": "Five Nights At Freddy's 4",
        "file": "Games/clFNAF4.html",
        "thumb": "Game Images/Fnaf4.png",
        "description": "Survive the night in a dark bedroom with nightmare animatronics outside the doors and around the room. Listen at each doorway before using the flashlight, and remember to check the closet and bed. If you hear breathing at a doorway, close it before shining the light.\n\nControls\nClick a door or the closet to approach it. Use Ctrl for the flashlight and hold Shift to close a door. Use the mouse to turn around and check the bed."
    },
    {
        "name": "Five Nights At Winstons",
        "file": "Games/clfnaw.html",
        "thumb": "Game Images/fnaw.png",
        "description": "Guard an office against wandering erasers in this fan-made night-shift horror game. Check camera feeds to learn which side they're approaching from and use the office doors when a threat gets close. Brief checks can help stretch the power through the night.\n\nControls\nUse the mouse to look around and click camera feeds, door controls, and lights."
    },
    {
        "name": "Bad Monday Simulator",
        "file": "Games/clbadmondaysimulator.html",
        "thumb": "Game Images/BMS.png",
        "description": "Play as Nermal in a Garfield and Undertale crossover where the boss fight keeps changing its attack patterns. Dodge projectiles between turns, then pick actions from the battle menu. Watch for moves that change how your heart behaves and adjust before the next wave.\n\nControls\nUse the arrow keys to move your heart and navigate menus, Z to confirm, and X to cancel."
    },
    {
        "name": "Bad Time Simulator",
        "file": "Games/clbadtimesim.html",
        "thumb": "Game Images/BTS.png",
        "description": "Practice the Sans fight from Undertale and learn to survive increasingly demanding attacks. Dodge bones and blasters, and be ready for gravity changes when your heart turns blue. Short, deliberate movements make it easier to stay within the safe gaps.\n\nControls\nUse the arrow keys to move and navigate menus, Z to confirm, and X to cancel."
    },
    {
        "name": "Sort The Court",
        "file": "Games/clsortthecourt.html",
        "thumb": "Game Images/STC.png",
        "description": "Make yes-or-no decisions for petitioners who visit your throne. Choices can change the kingdom's gold, population, and happiness, and some characters return with follow-up requests. Check whether you can afford a deal before promising resources you might need later.\n\nControls\nPress Y to say yes or N to say no. You can also click the matching on-screen choice."
    },
    {
        "name": "The Man From The Window",
        "file": "Games/clthemaninthewindow.html",
        "thumb": "Game Images/TMFTW.png",
        "description": "A storybook warns that a visitor is coming for Mama Rabbit and Junior. You have only a few in-game minutes to read the clues, slow the visitor down, and choose where to hide. Pay close attention to the order of the clues because it affects which hiding places are safe.\n\nControls\nUse WASD to move and the mouse to look. Use the mouse buttons to interact with objects and follow the on-screen prompts for specific actions."
    },
    {
        "name": "Five Nights At Epsteins",
        "file": "Games/clfivenightsatepsteins.html",
        "thumb": "Game Images/FNAE.png",
        "description": "Survive a night shift in a short horror parody based on the camera-and-office format. Track approaching threats and pay attention to audio clues while deciding when to check the monitor or use a defense. Read the current night's prompts to learn what each threat responds to.\n\nControls\nUse the mouse to look around the office and select on-screen camera and defense controls. Follow any additional prompts shown by the game."
    },
    {
        "name": "Agar.io",
        "file": "Games/clagariolite.html",
        "thumb": "Game Images/agario.png",
        "description": "Guide a round cell around the arena and absorb food and smaller cells to grow. Bigger opponents can swallow you, so leave an escape route before chasing another cell. Larger cells can cover more space, but moving early is still the easiest way to stay out of trouble.\n\nControls\nMove the mouse to steer your cell toward the pointer."
    },
    {
        "name": "Hollow Knight",
        "file": "Games/HK.html",
        "thumb": "Game Images/HollowKnight.png",
        "description": "Explore Hallownest, an underground kingdom full of winding paths, strange insects, and bosses. Strike enemies with your Nail to gather Soul for healing or spells. Buy maps and remember blocked routes so you can return when new abilities let you reach them.\n\nControls\nUse the arrow keys to move, Z to jump, and X to attack. Hold A to Focus and heal. Use C to dash once you unlock it. Check the in-game bindings for other actions."
    },
    {
        "name": "2048",
        "file": "Games/cl2048.html",
        "thumb": "Game Images/2048.png",
        "description": "Slide numbered tiles around a four-by-four board and merge matching values to make larger ones. New tiles appear after successful moves, so manage the free space as you work toward a 2048 tile. Keeping your largest tile in a corner helps you build a chain toward it.\n\nControls\nUse the arrow keys to slide all tiles in one direction. Matching tiles merge once per move."
    },
    {
        "name": "1v1.lol",
        "file": "Games/cl1v1lol.html",
        "thumb": "Game Images/1v1.png",
        "description": "Face another player in a third-person arena where you can build cover and platforms while fighting. Place walls to break sightlines, use ramps to take higher ground, and learn to switch back to your weapon as soon as you finish building.\n\nControls\nUse WASD to move, mouse to aim and shoot, and Space to jump. Use the build and edit keys shown in the settings to select pieces and change structures."
    },
    {
        "name": "Geometry Dash",
        "file": "Games/clgeometrydashscratch.html",
        "thumb": "Game Images/gds.png",
        "description": "Guide a cube that moves automatically through obstacles in this Scratch version of Geometry Dash. Time each jump to clear spikes and land on the next platform. The music can help you find a rhythm, and repeating short sections makes the trickier patterns easier to learn.\n\nControls\nPress Space or Up Arrow, or click to jump. Hold the input to keep jumping where the current level allows it."
    },
    {
        "name": "Escape Road",
        "file": "Games/clescaperoad.html",
        "thumb": "Game Images/er.png",
        "description": "Steer through a city as police cars close in from all directions. Take quick turns through side streets, keep clear of water and dead ends, and collect rewards for unlocking cars. A route with several exits gives you room to turn before the chase boxes you in.\n\nControls\nUse A and D or Left and Right to steer the moving car."
    },
    {
        "name": "Escape Road 2",
        "file": "Games/clescaperoad-2.html",
        "thumb": "Game Images/er2.png",
        "description": "Stay ahead of the police through city streets, alleys, and other routes. You can leave a damaged or trapped vehicle and continue on foot before taking another one. Look for a clear route away from traffic before switching vehicles.\n\nControls\nUse WASD or the arrow keys to steer or move. Press Space to exit a vehicle or enter one nearby."
    },
    {
        "name": "Duck Life 2",
        "file": "MultiFile Games\\DuckLife2-main\\DuckLife2-main/index.html",
        "thumb": "Game Images/dl2.png",
        "description": "Train a duck to compete in races around the world. Running, swimming, flying, and climbing each have their own training games, and your stats determine how the duck performs on race day. Feed it before racing so it has enough energy to finish.\n\nControls\nUse the mouse for menus and feeding. In training, use the displayed arrow-key prompts to jump, steer, dive, or climb. Races run automatically."
    },
    {
        "name": "Duck Life 3",
        "file": "MultiFile Games\\DuckLife3-main\\DuckLife3-main/index.html",
        "thumb": "Game Images/dl3.png",
        "description": "Choose an evolved duck, build up its skills in training games, and race through increasingly tough leagues. Each duck starts with different strengths. Watch where your duck falls behind in a race, then train that skill and refill its energy before retrying.\n\nControls\nClick to select training, feed your duck, or enter a race. Follow the arrow-key prompts in each training event. Races run automatically."
    },
    {
        "name": "There Is No Game",
        "file": "Games/clthereisnofile.html",
        "thumb": "Game Images/ting.png",
        "description": "Explore a screen that insists it contains no game at all. Tug on letters, click suspicious objects, and try combining parts of the interface to uncover the next puzzle. Listen to the narrator and revisit objects when the screen changes.\n\nControls\nUse the mouse to click objects or hold and drag them. Listen and watch for clues about what can move."
    },
    {
        "name": "UNO",
        "file": "Games/cluno.html",
        "thumb": "Game Images/uno.png",
        "description": "Get rid of your cards by matching the top card's color, number, or symbol. Skips, reverses, and draw cards can turn the round around, while wild cards let you pick the color. Watch opponents' hand sizes and call UNO when you're down to one card.\n\nControls\nClick a card to play it, the draw pile to draw, and the color choice when playing a wild. Use the UNO button when it appears."
    },
    {
        "name": "Friday Night Funkin",
        "file": "Games/clfridaynightfunkin.html",
        "thumb": "Game Images/fnf.png",
        "description": "Take on opponents in musical battles by hitting notes as they cross the receptors. Keep your inputs on beat to build your score and stay in the song. Start on an easier difficulty if a chart introduces patterns you haven't learned yet.\n\nControls\nUse the arrow keys to hit matching notes, and hold the direction for sustained notes. Use Enter and the arrow keys to navigate the menus."
    },
    {
        "name": "Don't You Lecture Me With Your 30 Dollar Website",
        "file": "Games/cldontyoulectureme.html",
        "thumb": "Game Images/dulmwy3dw.png",
        "description": "Build music from a grid of sound effects and samples. Arrange sounds in sequence, change the tempo, and play your creation back to hear how the parts fit. Start with a short beat and add layers once you have a rhythm you like.\n\nControls\nLeft-click a sound to add it, then use the on-screen controls to arrange, remove, or play back sounds. Tempo and section controls are available in the editor."
    },
    {
        "name": "Retro Bowl",
        "file": "Games/clretrobowl.html",
        "thumb": "Game Images/rb.png",
        "description": "Coach an American football team and control its offense on game day. Draft players, manage contracts, and decide when to pass or run. Use short throws to keep drives alive and save deep passes for when your receiver has room behind the defense.\n\nControls\nClick and drag from the quarterback to aim a pass, then release to throw. Drag in the direction you want to dodge while running, and use the on-screen meter to kick."
    },
    {
        "name": "Retro Ping Pong",
        "file": "Games/clretropingpong.html",
        "thumb": "Game Images/rpp.png",
        "description": "Bounce the ball past your opponent's paddle to score. Classic Mode plays like Pong, while Action Mode changes the rules with extra hazards and effects. Aim near the edge of your paddle to send the ball back at a sharper angle.\n\nControls\nUse Up and Down to move your paddle. In local two-player mode, the other paddle uses W and S."
    },
    {
        "name": "Space Waves",
        "file": "Games/clspacewaves.html",
        "thumb": "Game Images/sw.png",
        "description": "Guide a fast-moving arrow through jagged passages packed with spikes and narrow gaps. The arrow climbs while you hold the input and dives as soon as you let go. Use short taps to stay near the center of a tight corridor.\n\nControls\nHold left click, W, or Space to rise. Release to descend."
    },
    {
        "name": "Idle Breakout",
        "file": "Games/clidlebreakout.html",
        "thumb": "Game Images/idlebreakout.png",
        "description": "Break bricks for cash and spend it on balls that bounce around the board automatically. Each ball type brings a different effect, and upgrades help you clear blocks with more health. Start by clicking valuable bricks, then let your purchased balls handle more of the work.\n\nControls\nClick bricks to deal damage. Click ball purchases, upgrades, and other shop buttons to spend what you earn."
    },
    {
        "name": "Revolution Idle",
        "file": "Games/clrevolutionidle.html",
        "thumb": "Game Images/ri.png",
        "description": "Watch colored circles complete revolutions to generate points, then spend those points to speed up the circles and buy new ones. Each upgrade compounds future earnings. As your run slows, use the progression menus to weigh reset bonuses against what you've built so far.\n\nControls\nClick circle upgrades and progression buttons. Check the cost and boost shown on each upgrade before buying."
    },
    {
        "name": "Another Generic Code Studio",
        "file": "Games/AGCS.html",
        "thumb": "Game Images/Ai.png",
        "description": "Write HTML, CSS, and JavaScript in a browser editor with a live preview beside it. Start from the example project, edit any of its three files, and watch your changes appear in the preview. Export when you want a standalone HTML copy of your project.\n\nControls\nClick the index.html, style.css, or script.js tab and type in the editor. Click Download Index.html to export the combined page."
    },
    {
        "name": "Gladihoppers",
        "file": "Games/clgladdihoppers.html",
        "thumb": "Game Images/gh.png",
        "description": "Duel gladiators with physics-based movement and two combat stances. Spacing matters because your reach changes with your stance and the timing of your steps. Let your opponent commit to a swing before moving in for a counter.\n\nControls\nUse WASD to move, the arrow keys to attack, E to throw a javelin, and Space to switch stances."
    },
    {
        "name": "Poly Track",
        "file": "Games/clpolytrackworksnow.html",
        "thumb": "Game Images/pt.png",
        "description": "Race against the clock on low-poly tracks with banked turns, jumps, and fast straights. Retry a route to shave time off your run, or use the track editor to build and test your own design. Focus first on clean landings before chasing a faster line.\n\nControls\nUse WASD or the arrow keys to drive and steer. Press R or Enter to restart a run. Use the editor toolbar to place and test track pieces."
    },
    {
        "name": "Fluidism",
        "file": "Games/clfluidism.html",
        "thumb": "Game Images/Fluidism.png",
        "description": "Paint with swirling colored fluid and watch the currents mix across the screen. Quick strokes make narrow trails, while slower overlapping strokes create bigger eddies. Try different combinations of motion and simulation settings to see how the fluid responds.\n\nControls\nClick and drag across the canvas to push the fluid around. Use the on-screen settings panel to adjust the simulation."
    },
    {
        "name": "Fruit Ninja",
        "file": "Games/clfruitninja.html",
        "thumb": "Game Images/fn.png",
        "description": "Slice fruit as it flies into view and leave bombs alone. Catch several pieces in one swipe for a combo, but watch for bombs mixed into the same wave. Short swipes give you more control when fruit and bombs are close together.\n\nControls\nHold left click and drag across fruit to slice it. Release between swipes to avoid cutting through a bomb."
    },
    {
        "name": "Escape Road 3",
        "file": "Games/clescaperoad3.html",
        "thumb": "Game Images/er3.png",
        "description": "Evade an escalating police chase through a city with streets, alleys, and open areas. Swap vehicles when you're boxed in and use the garage to check the cars and characters you've unlocked. Plan your next turn before entering tight spaces where you could get trapped.\n\nControls\nSteer with A/D or Left/Right. Use S or Down to brake or reverse and Space to enter or exit a vehicle. Vehicles accelerate automatically."
    },
    {
        "name": "Granny 2",
        "file": "Games/granny2.html",
        "thumb": "Game Images/granny2.png",
        "description": "Find a way out of a house watched by both Granny and Grandpa. Search rooms for keys and tools, then decide which escape route to prepare. Granny reacts to dropped objects, so plan where to hide before leaving anything on the floor.\n\nControls\nUse WASD to move, mouse to look, E to interact, C to crouch, and Space to drop an item. Follow the room's prompt to enter or leave a hiding spot."
    },
    {
        "name": "Handulum",
        "file": "Games/clhandulum.html",
        "thumb": "Game Images/handulum.png",
        "description": "Swing a ball through obstacle courses by attaching a rope to a point on the screen. Use the arc of each swing to build speed, then release at the right moment to fly toward the next opening. Pick a new anchor before you lose too much height.\n\nControls\nClick and hold to attach the rope at the pointer. Release the mouse button to let go and carry your momentum forward."
    },
    {
        "name": "OVO",
        "file": "Games/clovofixed.html",
        "thumb": "Game Images/ovo.png",
        "description": "Race to the finish flag in a fast-paced parkour platformer built around momentum. Slide under spikes, wall-jump out of narrow shafts, and smash through transparent platforms to open up new routes. Collect bonus coins to unlock skins, then replay levels to find faster ways through.\n\nControls\n\nUse Left and Right to move and Up to jump. Press Down while running to slide or while airborne to smash downward. Press Up while sliding to jump farther, or press Up against a wall to wall-jump. Jump immediately after a smash to bounce higher."
    },
    {
        "name": "OVO 2",
        "file": "Games/clovo2.html",
        "thumb": "Game Images/ovo2.png",
        "description": "Take on new parkour courses filled with spikes, moving platforms, and tight passages. Chain slides, jumps, and wall-jumps to keep your speed all the way to the flag. Watch how the traps move on your first attempt, then come back for coins, new skins, and a faster finish.\n\nControls\n\nUse Left and Right to move and Up to jump. Press Down while running to slide under low obstacles or while airborne to smash downward. Press Up during a slide to clear longer gaps, or press Up while sliding down a wall to jump away from it."
    }
];

if (typeof module !== 'undefined') {
    module.exports = { gameList };
}
