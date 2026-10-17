const gameList = [
    {
        "name": "1",
        "file": "Games/cl1.html",
        "thumb": "Game Images/1.png",
        "description": "A classic arcade-style game with simple mechanics and addictive gameplay."
    },
    {
        "name": "Grindcraft",
        "file": "Games/clgrindcraft.html",
        "thumb": "Game Images/GC.png",
        "description": "An idle crafting game where you gather resources and build your civilization."
    },
    {
        "name": "A Dance Of Fire And Ice",
        "file": "Games/clADOFAI.html",
        "thumb": "Game Images/ADOFI.png",
        "description": "A rhythm game where you control two orbiting spheres to the beat of the music."
    },
    {
        "name": "10 Minutes Till Dawn",
        "file": "Games/cl10minutestildawn.html",
        "thumb": "Game Images/10mtd.png",
        "description": "Survive 10 minutes against waves of monsters in this roguelike shooter."
    },
    {
        "name": "12 Mini Battles",
        "file": "Games/cl12minibattles.html",
        "thumb": "Game Images/12-minibattles.png",
        "description": "A collection of 12 different mini-games playable with a friend."
    },
    {
        "name": "Adventure Capitalist",
        "file": "Games/clAdventureCapatalist.html",
        "thumb": "Game Images/AdventureCapitalist.png",
        "description": "An idle game where you build your business empire from scratch."
    },
    {
        "name": "Babel Tower",
        "file": "Games/clbabeltower.html",
        "thumb": "Game Images/Babel.png",
        "description": "Build the tallest tower in the world in this incremental game."
    },
    {
        "name": "Bacon May Die",
        "file": "Games/clbaconmaydie.html",
        "thumb": "Game Images/BaconMayDie.png",
        "description": "A fast-paced beat 'em up game featuring a bacon-loving pig."
    },
    {
        "name": "Big Ice Tower Tiny Square",
        "file": "Games/clbigicetowertinysquare.html",
        "thumb": "Game Images/bitts.png",
        "description": "Navigate a tiny square through a challenging ice tower."
    },
    {
        "name": "Big Neon Tower Tiny Square",
        "file": "Games/clbigneontowertinysquare.html",
        "thumb": "Game Images/bntts.png",
        "description": "A neon-themed platformer with challenging tower climbing."
    },
    {
        "name": "Big Tower Tiny Square 2",
        "file": "Games/clbtts2.html",
        "thumb": "Game Images/Big Tower Tiny Square 2.png",
        "description": "The sequel to the popular tower climbing platformer."
    },
    {
        "name": "Volley Random",
        "file": "Games/clvolleyrandom.html",
        "thumb": "Game Images/VolleyRandom.png",
        "description": "A physics-based volleyball game with ragdoll mechanics."
    },
    {
        "name": "Vex X3M",
        "file": "Games/clvexx3m.html",
        "thumb": "Game Images/vx3m.png",
        "description": "Another installment in the challenging Vex platformer series."
    },
    {
        "name": "Basket Random",
        "file": "Games/clbasketrandom.html",
        "thumb": "Game Images/BasketRandom.png",
        "description": "A chaotic basketball game with random physics."
    },
    {
        "name": "Boxing Random",
        "file": "Games/clboxingrandom.html",
        "thumb": "Game Images/Br.png",
        "description": "A physics-based boxing game with unpredictable outcomes."
    },
    {
        "name": "Bob The Robber 5",
        "file": "Games/clbobtherobber5.html",
        "thumb": "Game Images/btr5.png",
        "description": "Help Bob steal treasures while avoiding security in this stealth game."
    },
    {
        "name": "Bob The Robber 2",
        "file": "Games/clbobtherobber2.html",
        "thumb": "Game Images/btr2.png",
        "description": "The second adventure of the master thief Bob."
    },
    {
        "name": "Cluster Rush",
        "file": "Games/clclusterrush.html",
        "thumb": "Game Images/CR.png",
        "description": "A fast-paced platformer with cluster-based mechanics."
    },
    {
        "name": "Circloo 2",
        "file": "Games/clCircloO2.html",
        "thumb": "Game Images/circloo2.png",
        "description": "A physics puzzle game where you navigate circles through obstacles."
    },
    {
        "name": "Cookie Clicker",
        "file": "Games/clcookie-clicker.html",
        "thumb": "Game Images/CookieClicker.png",
        "description": "The classic idle game where you click to bake cookies."
    },
    {
        "name": "Crossy Road",
        "file": "Games/clcrossyroad.html",
        "thumb": "Game Images/Crossy Road.png",
        "description": "Help your character cross busy roads and rivers safely."
    },
    {
        "name": "ULTRAKILL",
        "file": "Games/ULTRAKILL.html",
        "thumb": "Game Images/ULTRAKILL.png",
        "description": "A fast-paced first-person shooter with retro aesthetics."
    },
    {
        "name": "TAG",
        "file": "Games/cltagcm.html",
        "thumb": "Game Images/TAG.png",
        "description": "A multiplayer game of tag with various power-ups."
    },
    {
        "name": "Half Life",
        "file": "Games/clhalflife.html",
        "thumb": "Game Images/HL.png",
        "description": "The legendary first-person shooter game."
    },
    {
        "name": "Cs:Go Clicker",
        "file": "Games/clcsgoclicker.html",
        "thumb": "Game Images/csgoclicker.png",
        "description": "An idle clicker game themed around CS:GO."
    },
    {
        "name": "Minecraft 1.9.4",
        "file": "Games/clEaglercraftL_19_v0_7_0_Offline_Signed.html",
        "thumb": "Game Images/mc.png",
        "description": "Play Minecraft 1.9.4 in your browser with Eaglercraft."
    },
    {
        "name": "Block The Pig",
        "file": "Games/clblockthepig.html",
        "thumb": "Game Images/blockthepig.png",
        "description": "A puzzle game where you block a clever pig from escaping."
    },
    {
        "name": "Deadly Descent",
        "file": "Games/cldeadlydescent.html",
        "thumb": "Game Images/Deadly Descent.png",
        "description": "Race down dangerous slopes in this extreme sports game."
    },
    {
        "name": "Doge Miner",
        "file": "Games/cldogeminer.html",
        "thumb": "Game Images/DM.png",
        "description": "An idle game where you mine dogecoins with the help of Doge."
    },
    {
        "name": "Doge Miner 2",
        "file": "Games/cldogeminer2.html",
        "thumb": "Game Images/DM2.png",
        "description": "The sequel to the popular Doge Miner idle game."
    },
    {
        "name": "Drift Boss",
        "file": "Games/cldriftboss.html",
        "thumb": "Game Images/DB.png",
        "description": "A drift racing game with simple one-touch controls."
    },
    {
        "name": "Granny",
        "file": "Games/clgrannyy.html",
        "thumb": "Game Images/Granny.png",
        "description": "Escape from Granny's house in this horror survival game."
    },
    {
        "name": "Gun Spin",
        "file": "Games/clgun-spin.html",
        "thumb": "Game Images/Gunspin.png",
        "description": "A physics-based game where you spin guns to defeat enemies."
    },
    {
        "name": "Idle Dice",
        "file": "Games/clidledice.html",
        "thumb": "Game Images/Idle Dice.png",
        "description": "Roll dice and upgrade your equipment in this idle game."
    },
    {
        "name": "DreadHead Parkour",
        "file": "Games/cldreadheadparkour.html",
        "thumb": "Game Images/DHP.png",
        "description": "Perform parkour stunts in this urban running game."
    },
    {
        "name": "We Become What We Behold",
        "file": "Games/clwebecomewhatwebehold.html",
        "thumb": "Game Images/WBWWB.png",
        "description": "A short narrative game about media influence and perception."
    },
    {
        "name": "Vex3",
        "file": "Games/clvex3.html",
        "thumb": "Game Images/Vex3.png",
        "description": "The third installment in the challenging Vex platformer series."
    },
    {
        "name": "Ragdoll Archers",
        "file": "Games/clragdollarchers.html",
        "thumb": "Game Images/RagdollArchers.png",
        "description": "A physics-based archery game with ragdoll characters."
    },
    {
        "name": "Rooftop Snipers",
        "file": "Games/clrooftopsnipers.html",
        "thumb": "Game Images/RooftopSnipers.png",
        "description": "A 2-player sniper game set on rooftops."
    },
    {
        "name": "Rooftop Snipers 2",
        "file": "Games/clrooftopsnipers2.html",
        "thumb": "Game Images/RooftopSnipers2.png",
        "description": "The sequel to the popular rooftop sniper game."
    },
    {
        "name": "MotoX3m 2",
        "file": "Games/clmotox3m2.html",
        "thumb": "Game Images/Motox3m2.png",
        "description": "The second motorcycle racing game in the MotoX3m series."
    },
    {
        "name": "MotoX3m 3",
        "file": "Games/clmotox3m3.html",
        "thumb": "Game Images/Motox3m3.png",
        "description": "The third installment with more challenging tracks and stunts."
    },
    {
        "name": "MotoX3m",
        "file": "Games/clmotox3mm.html",
        "thumb": "Game Images/Motox3m.png",
        "description": "A motorcycle racing game with challenging obstacle courses."
    },
    {
        "name": "Mr.Mine",
        "file": "Games/clmrmine.html",
        "thumb": "Game Images/MrMine.png",
        "description": "An idle mining game where you dig deeper and find treasures."
    },
    {
        "name": "Run 3",
        "file": "Games/clrun3.html",
        "thumb": "Game Images/Run3.png",
        "description": "Run through space tunnels in this endless runner game."
    },
    {
        "name": "Baldi's Basics",
        "file": "Games/clbaldisbasics.html",
        "thumb": "Game Images/Baldi.png",
        "description": "A horror game inspired by educational games from the 90s."
    },
    {
        "name": "Capybara Clicker",
        "file": "Games/clcapybaraclicker.html",
        "thumb": "Game Images/CapybaraClicker.png",
        "description": "An idle clicker game featuring adorable capybaras."
    },
    {
        "name": "Minecraft 1.11.2",
        "file": "Games/clEaglercraftZ_1112.html",
        "thumb": "Game Images/mc1.11.2.png",
        "description": "Play Minecraft 1.11.2 in your browser with Eaglercraft."
    },
    {
        "name": "Minecraft 1.12.2",
        "file": "Games/Eaglercraft1.12.html",
        "thumb": "Game Images/mc1.12.2.png",
        "description": "Play Minecraft 1.12.2 in your browser with Eaglercraft."
    },
    {
        "name": "Just One Boss",
        "file": "Games/cljustoneboss.html",
        "thumb": "Game Images/job.png",
        "description": "A boss rush game where you face challenging bosses."
    },
    {
        "name": "Five Nights At Freddy's 1",
        "file": "Games/clFNAF.html",
        "thumb": "Game Images/Fnaf.png",
        "description": "Survive five nights at Freddy Fazbear's Pizza in this horror game."
    },
    {
        "name": "Five Nights At Freddy's 2",
        "file": "Games/clFNAF2.html",
        "thumb": "Game Images/Fnaf2.png",
        "description": "The sequel to the popular FNAF horror game."
    },
    {
        "name": "Five Nights At Freddy's 3",
        "file": "Games/clFNAF3.html",
        "thumb": "Game Images/Fnaf3.png",
        "description": "The third installment in the Five Nights at Freddy's series."
    },
    {
        "name": "Five Nights At Freddy's 4",
        "file": "Games/clFNAF4.html",
        "thumb": "Game Images/Fnaf4.png",
        "description": "The fourth game in the FNAF series with nightmare animatronics."
    },
    {
        "name": "Five Nights At Winstons",
        "file": "Games/clfnaw.html",
        "thumb": "Game Images/fnaw.png",
        "description": "A parody of the FNAF series with Winston Churchill."
    },
    {
        "name": "Bad Monday Simulator",
        "file": "Games/clbadmondaysimulator.html",
        "thumb": "Game Images/BMS.png",
        "description": "A Sonic-themed boss rush game with challenging battles."
    },
    {
        "name": "Bad Time Simulator",
        "file": "Games/clbadtimesim.html",
        "thumb": "Game Images/BTS.png",
        "description": "A Sans battle simulator from Undertale."
    },
    {
        "name": "Sort The Court",
        "file": "Games/clsortthecourt.html",
        "thumb": "Game Images/STC.png",
        "description": "Rule your kingdom by making simple yes/no decisions."
    },
    {
        "name": "The Man From The Window",
        "file": "Games/clthemaninthewindow.html",
        "thumb": "Game Images/TMFTW.png",
        "description": "A short horror game about a mysterious visitor."
    },
    {
        "name": "Five Nights At Epsteins",
        "file": "Games/clfivenightsatepsteins.html",
        "thumb": "Game Images/FNAE.png",
        "description": "A parody horror game with dark humor."
    },
    {
        "name": "Agar.io",
        "file": "Games/clagariolite.html",
        "thumb": "Game Images/agario.png",
        "description": "Consume smaller cells to grow in this popular multiplayer game."
    },
    {
        "name": "Hollow Knight",
        "file": "Games/HK.html",
        "thumb": "Game Images/HollowKnight.png",
        "description": "A challenging action-adventure game with beautiful hand-drawn art."
    },
    {
        "name": "2048",
        "file": "Games/cl2048.html",
        "thumb": "Game Images/2048.png",
        "description": "Slide and combine numbered tiles to reach 2048."
    },
    {
        "name": "1v1.lol",
        "file": "Games/cl1v1lol.html",
        "thumb": "Game Images/1v1.png",
        "description": "A building and shooting game similar to Fortnite."
    },
    {
        "name": "Geometry Dash",
        "file": "Games/clgeometrydashscratch.html",
        "thumb": "Game Images/gds.png",
        "description": "A rhythm-based platformer with challenging levels."
    },
    {
        "name": "Escape Road",
        "file": "Games/clescaperoad.html",
        "thumb": "Game Images/er.png",
        "description": "Escape from police in this high-speed chase game."
    },
    {
        "name": "Escape Road 2",
        "file": "Games/clescaperoad-2.html",
        "thumb": "Game Images/er2.png",
        "description": "The sequel with more intense police chases and vehicles."
    },
    {
        "name": "Duck Life 2",
        "file": "MultiFile Games\\DuckLife2-main\\DuckLife2-main/index.html",
        "thumb": "Game Images/dl2.png",
        "description": "Train your duck to become the champion racer."
    },
    {
        "name": "Duck Life 3",
        "file": "MultiFile Games\\DuckLife3-main\\DuckLife3-main/index.html",
        "thumb": "Game Images/dl3.png",
        "description": "Evolve your duck and compete in various events."
    },
    {
        "name": "Duck Life 4",
        "file": "MultiFile Games\\DuckLife4-main\\DuckLife4-main/index.html",
        "thumb": "Game Images/dl4.png",
        "description": "The fourth Duck Life game with new training mini-games."
    },
    {
        "name": "There Is No Game",
        "file": "Games/clthereisnofile.html",
        "thumb": "Game Images/ting.png",
        "description": "A meta puzzle game that breaks the fourth wall."
    },
    {
        "name": "UNO",
        "file": "Games/cluno.html",
        "thumb": "Game Images/uno.png",
        "description": "The classic card game UNO playable in your browser."
    },
    {
        "name": "Friday Night Funkin",
        "file": "Games/clfridaynightfunkin.html",
        "thumb": "Game Images/fnf.png",
        "description": "A rhythm game where you battle through musical showdowns."
    },
    {
        "name": "Don't You Lecture Me With Your 30 Dollar Website",
        "file": "Games/cldontyoulectureme.html",
        "thumb": "Game Images/dulmwy3dw.png",
        "description": "A humorous game about website development."
    },
    {
        "name": "Retro Bowl",
        "file": "Games/clretrobowl.html",
        "thumb": "Game Images/rb.png",
        "description": "A retro-style American football game."
    },
    {
        "name": "Retro Ping Pong",
        "file": "Games/clretropingpong.html",
        "thumb": "Game Images/rpp.png",
        "description": "Classic ping pong with retro graphics."
    },
    {
        "name": "Space Waves",
        "file": "Games/clspacewaves.html",
        "thumb": "Game Images/sw.png",
        "description": "Navigate through space waves in this rhythm-based game."
    },
    {
        "name": "Idle Breakout",
        "file": "Games/clidlebreakout.html",
        "thumb": "Game Images/idlebreakout.png",
        "description": "Break bricks and upgrade your balls in this idle game."
    },
    {
        "name": "Revolution Idle",
        "file": "Games/clrevolutionidle.html",
        "thumb": "Game Images/ri.png",
        "description": "An idle game with a revolutionary theme."
    },
    {
        "name": "Another Generic Code Studio",
        "file": "Games/AGCS.html",
        "thumb": "Game Images/Ai.png",
        "description": "A code studio game for learning programming concepts."
    },
    {
        "name": "Gladihoppers",
        "file": "Games/clgladdihoppers.html",
        "thumb": "Game Images/gh.png",
        "description": "A gladiator fighting game with physics-based combat."
    },
    {
        "name": "Poly Track",
        "file": "Games/clpolytrackworksnow.html",
        "thumb": "Game Images/pt.png",
        "description": "Build and race on your own tracks in this creative game."
    },
    {
        "name": "Fluidism",
        "file": "Games/clfluidism.html",
        "thumb": "Game Images/Fluidism.png",
        "description": "A relaxing fluid simulation game."
    },
    {
        "name": "Fruit Ninja",
        "file": "Games/clfruitninja.html",
        "thumb": "Game Images/fn.png",
        "description": "Slice flying fruits in this classic arcade game."
    }
];

if (typeof module !== 'undefined') {
    module.exports = { gameList };
}