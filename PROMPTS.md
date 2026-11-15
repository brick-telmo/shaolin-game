# Game-building prompts

These are the user-provided requests used to build and extend **Five Forms — Shaolin Arcade**, in chronological order. The prompts are reproduced verbatim, including spelling. They describe the game and repository request; unrelated correspondence is omitted.

## 1. Original game brief

> let's build a 2d sprite based game with 5 charactrs represeting the kung-fu animals: snake, tirger, leopard, dragon and crane. Use information on shaolin kung fu to generate the characters. use their characteritics to define their moves. they ahould till be humanoids. it can be a two player or single player (against cpu) fighting game. players start with three lives.

## 2. Animal home courts and a neutral volcano

> create 5 new backgrounds, one for each style representing the animals. When that style fights at its home court it has a slight speed advantage (just 1%). the sixth arena is a neutral ground with the background of a vulcano.

## 3. Public source and prompt history

> can you add the code to a public github repo along with the prompts used

## Implementation notes

The game was implemented in HTML, CSS and JavaScript. Original humanoid sprites, scenery, animation frames and effects are drawn in Canvas. There were no separate image-generation prompts or downloaded artwork. The five traditional styles were researched using the two practicing-school sources linked in the README and the in-game guide.

The requested home-court advantage is implemented as a **1.01 multiplier on horizontal movement**, including special-move travel, for a fighter whose style matches the selected arena. The six backgrounds are the Snake's Jade Coil Grove, Tiger's Amber Fang Gate, Leopard's Golden Canopy, Dragon's Stormspire Shrine, Crane's Moonwater Pavilion, and the neutral Cinder Caldera volcano.
