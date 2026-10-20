# Pulse — A building, in balance

A procedural Three.js architectural experience. A single persistent scene connects the office fan coil, chilled-water branch, paired risers, circulation pump, and ground-level chiller.

The main tower has blue-gray reflective glazing with a procedural sky/city reflection, subtle pane variations, horizontal transoms, 560 ACP spandrel panels, recessed joints, and vertical metal fins. A glazed lobby entrance and metal canopy add ground-level detail. The new façade layers follow the same floor cutaways and become translucent during the final circuit view; surrounding buildings remain lighter so the main tower stands out.

The close, elevated exterior view places the blue-gray tower in a district of 59 differently sized buildings with glazed window bands, mullions, entrance canopies, roof parapets, marked streets, planted sidewalks, a river, and five raised road bridges. Static environment reflections add depth to the architectural glazing. Two wind turbines rotate; six vehicles include cars, buses, and delivery trucks. Traffic leaves beyond the visible district, waits for varied intervals, then returns with varied speeds while maintaining lane spacing. A cabin boat follows the river bends beneath the raised bridges. Static district geometry is batched by material to keep the larger scene efficient. The district fades on the same reversible scroll timeline as the camera enters the office and reappears during the final pullback.

The interface displays the supplied Pulse logo and a bottom-center **Scroll** prompt. Unlabeled chapter dots and an animation-pause icon sit on the right. The initial building has no active alarm indicator: scrolling first reveals a gently pulsing red (`#E80004`) floor, and recovery later changes it to green (`#19A877`).

The landing view includes light glass navigation with black text, the headline **One platform. Smarter buildings.**, and two call-to-action buttons. The navigation and **Contact** share a 44px height. **Contact** and **Explore the platform** use the same translucent glass finish; the demo button retains its blue gradient. **Explore the platform** enters the scroll story; the hero fades away on the same reversible timeline. The mobile navigation opens with **Menu** and closes with Escape or an outside click. As requested for this preview, the menu destinations, **Contact**, and **Book your live demo** are disabled until real destination URLs are supplied; no form submissions or bookings are simulated.

The final frame replaces the recovery overlays with a bottom-centered **Explore Pulse Building Management Solution** message and **Request for a demo** button. The desktop headline is 35px on one line, wrapping and scaling down on smaller screens. Two lines of 14px gray supporting text sit below the headline. The demo button remains preview-only, like the opening booking button.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Scroll through the story or select a chapter using the right-side dots. Click **Scroll** to reveal the initial alarm; the prompt disappears as soon as scrolling begins and returns at the top. Click the Pulse logo to return to the initial view. The pause icon stops turbines, traffic, the boat, continuous flow, alarm pulsing, and the inspection preview without disabling scroll navigation.

```sh
npm run build
npm run preview
```

## Story and accessibility

One GSAP ScrollTrigger timeline drives camera position, camera target, facade and ceiling cutaways, the isolation valves, removable inspection sleeve, obstruction, circuit flow, and recovery. Reverse scrolling restores the corresponding fault and repair state. Status clears only after the repaired circuit has circulated.

A light-glass **Alarm center** panel replaces the floating alarm icon. It appears after alarm activation and connects to the affected floor with a screen-space line that follows the 3D camera. **Inspect affected office** advances into the room, where the panel becomes a five-step recovery checklist. Disabled checkboxes automatically complete as scrolling reviews the fault, isolates the section, clears the blockage, restores the pipe, and verifies circulation. The recovery bar advances from 0% through red (`#E80004`) and muted amber to green (`#19A877`); 100% and **Issue solved** appear only after the pipe is restored, water is circulating, and the healthy transition is complete. Reversing the scroll reverses all checks and progress. These are explanatory simulation states, not live building readings or a maintenance procedure.

The alarm panel uses untinted glass with equipment details and two explicitly labeled sample alerts. Its separate, illustrative 3D valve cutaway includes flanges, bolts, a handwheel, the obstruction, and upstream water markers. It rotates automatically, supports dragging and arrow keys, and has a local pause control. It shares the main animation tick and stops updating when hidden; global pause and reduced motion also stop its automatic rotation. The recovery checklist has no background, border, or blur, and the recovery card is horizontally centered.

Click the valve preview (or focus it and press Enter/Space) to open a larger glass inspection dialog. Scroll the wheel or trackpad to rotate through a full 360 degrees, drag to orbit, or use the arrow keys. The enlarged model is manually controlled, including under reduced motion, and automatically fits narrow screens. Reset view returns to its opening angle. Escape or the close button dismisses the dialog and restores focus; the background story cannot be scrolled while inspecting.

Water markers stay within the connected supply, serpentine coil, and return routes. Air follows separate paths through the fan coil and room; it never travels through water pipes. This is an explanatory schematic, not a plumbing repair procedure or engineering specification.

Airflow uses three continuous loops through the actual return grille, FCU coil, supply duct, and occupied space. Translucent ribbons and tangent-aligned arrows distinguish muted warm return air from blue cooled supply air, changing color across the coil. Airflow appears only after recovery, fades out during the building pullback, and respects pause and reduced-motion preferences.

Reduced-motion preferences remove timeline catch-up, continuous particles, fan/turbine rotation, traffic movement, and alarm pulsing. Chapter navigation remains available. Accessible control names and a screen-reader-only live region describe each stage without adding visible captions. The responsive layout supports mobile and desktop.

All geometry is generated locally; no external 3D assets are required. The supplied Pulse image is cropped and background-cleaned in `public/pulse-logo.png`. Barlow fonts are bundled locally in `public/fonts/`, together with their SIL Open Font License, so typography does not depend on Google Fonts at runtime.

## Architectural scale

Scene units are metres. The tower uses 3.6 m floor-to-floor spacing, with 2.72 m clear height in the office. The concealed ducted fan coil measures 1.50 × 0.90 × 0.32 m and fits between the suspended ceiling and the slab above. Its twin blowers, vertical finned coil, short supply/return-air ducts, flush ceiling grilles, suspension rods, and trapped condensate drain remain in that same service void.

Office branches have 54 mm illustrated outside diameter and coil tubes have 16 mm diameter; larger riser jackets represent insulation. The office has two walnut workstations, ergonomic chairs, upholstered lounge seating, stone flooring, and perimeter lighting. The former timber feature wall is now honed light-gray limestone with procedural grain, fine veins, and brushed-metal joints. One wall-mounted smart room controller combines HVAC +/-, light toggle, volume +/-, and fan-speed icons with the simulated room temperature, cooling from 26.5 C to 22 C as airflow returns. A ceiling CCTV dome and presence sensor complete the room devices. The display is illustrative, not live telemetry or interactive building controls. Dimensions are plausible visualization proportions, not a manufacturer-specific selection or a code-compliance design.

A wall-mounted fire extinguisher includes a hose, gauge, handle, and instruction label. Hover over the controller, CCTV, presence sensor, or extinguisher for a short description; keyboard focus and tapping also reveal these labels. The labels gently fade and rise, remain inside the viewport, and disappear outside the room view. Escape dismisses them, and reduced motion removes the transition.

Device cards also show simulated health and connectivity, plus room-wide counts derived from the three modeled electronic devices (three active, zero inactive). The passive extinguisher is not counted as an offline electronic device. Controller details include the same room temperature as its 3D screen, setpoint, lights, presence, fan status, cooling status, and an illustrative story-temperature trend. Camera and presence cards show their relevant room status; the extinguisher shows illustrative readiness and installation details, not a real inspection record. Temperature and cooling status reverse with the scroll story. An interrupted cooling branch is shown separately from the controller's own healthy/online state.

## Browser checks

```sh
npx playwright install chromium
npm test
```

Tests cover delayed alarm activation and blinking, forward/reverse narrative states, restored flow preceding alarm clearance, moving/paused turbines and traffic, landing navigation and hero visibility, Pulse/Barlow assets, right-side navigation, smooth scroll catch-up, high-density rendering budgets, mobile overflow, reduced motion, browser errors, FCU clearances, and continuity at every water-route junction.
