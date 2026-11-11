// The visible XR exit must remain reachable through scene geometry.
export function selectInteractionHit(hits) {
    return hits.find(hit => hit.object.userData?.vrExitControl) || hits[0] || null;
}
