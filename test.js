const code = `
    const snap = viewportStoreRef.current?.get()
    let initialPosition = undefined
    if (!parentId && snap && snap.canvasWidth > 0 && snap.canvasHeight > 0) {
      initialPosition = {
        x: (snap.canvasWidth / 2 - snap.position.x) / snap.scale - 160,
        y: (snap.canvasHeight / 2 - snap.position.y) / snap.scale - 100,
      }
    }
`
console.log("Looks correct")
