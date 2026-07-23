package positions

import "mastermind/parser/internal/replay"

type Sample struct {
	Tick         int
	X            *float64
	Y            *float64
	Z            *float64
	Yaw          *float64
	Pitch        *float64
	EyeX         *float64
	EyeY         *float64
	EyeZ         *float64
	IsScoped     *bool
	ZoomLevel    *int
	ViewmodelFOV *float64
	ViewmodelX   *float64
	ViewmodelY   *float64
	ViewmodelZ   *float64
	RecoilIndex  *float64
	IsWalking    *bool
	IsDucking    *bool
	IsOnGround   *bool
	Alive        bool
	HasBomb      bool
	Health       *int
	Armor        *int
	Helmet       bool
	Money        *int
	Weapon       *string
	WeaponClass  *string
	MainWeapon   *string
	Flashbangs   *int
	Smokes       *int
	HEGrenades   *int
	FireGrenades *int
	Decoys       *int
}

type Builder struct {
	playerID string
	side     *string

	started    bool
	startTick  int
	lastTick   int
	lastSample Sample

	x       []*float64
	y       []*float64
	z       []*float64
	yaw     []*float64
	pitch   []*float64
	eyeX    []*float64
	eyeY    []*float64
	eyeZ    []*float64
	scoped  []*bool
	zoom    []*int
	vmFov   []*float64
	vmX     []*float64
	vmY     []*float64
	vmZ     []*float64
	recoil  []*float64
	walking []*bool
	ducking []*bool
	ground  []*bool
	alive   []bool
	hasBomb []bool
	health  []*int
	armor   []*int
	helmet  []bool
	money   []*int
	weapon  []*string
	class   []*string
	main    []*string
	flash   []*int
	smoke   []*int
	he      []*int
	fire    []*int
	decoy   []*int
}

func NewBuilder(playerID string, side *string) *Builder {
	return &Builder{
		playerID: playerID,
		side:     side,
		x:        []*float64{},
		y:        []*float64{},
		z:        []*float64{},
		yaw:      []*float64{},
		pitch:    []*float64{},
		eyeX:     []*float64{},
		eyeY:     []*float64{},
		eyeZ:     []*float64{},
		scoped:   []*bool{},
		zoom:     []*int{},
		vmFov:    []*float64{},
		vmX:      []*float64{},
		vmY:      []*float64{},
		vmZ:      []*float64{},
		recoil:   []*float64{},
		walking:  []*bool{},
		ducking:  []*bool{},
		ground:   []*bool{},
		alive:    []bool{},
		hasBomb:  []bool{},
		health:   []*int{},
		armor:    []*int{},
		helmet:   []bool{},
		money:    []*int{},
		weapon:   []*string{},
		class:    []*string{},
		main:     []*string{},
		flash:    []*int{},
		smoke:    []*int{},
		he:       []*int{},
		fire:     []*int{},
		decoy:    []*int{},
	}
}

func (b *Builder) Append(sample Sample) {
	if !b.started {
		b.started = true
		b.startTick = sample.Tick
		b.lastTick = sample.Tick
		b.appendSample(sample)
		return
	}

	for tick := b.lastTick + 1; tick < sample.Tick; tick++ {
		gapSample := b.lastSample
		gapSample.Tick = tick
		b.appendSample(gapSample)
	}

	b.appendSample(sample)
}

func (b *Builder) Build() *replay.PlayerStream {
	if !b.started {
		return nil
	}

	return &replay.PlayerStream{
		PlayerID:            b.playerID,
		Side:                b.side,
		SampleOriginTick:    b.startTick,
		SampleIntervalTicks: 1,
		X:                   b.x,
		Y:                   b.y,
		Z:                   b.z,
		Yaw:                 b.yaw,
		Pitch:               b.pitch,
		EyeX:                b.eyeX,
		EyeY:                b.eyeY,
		EyeZ:                b.eyeZ,
		IsScoped:            b.scoped,
		ZoomLevel:           b.zoom,
		ViewmodelFOV:        b.vmFov,
		ViewmodelOffsetX:    b.vmX,
		ViewmodelOffsetY:    b.vmY,
		ViewmodelOffsetZ:    b.vmZ,
		RecoilIndex:         b.recoil,
		IsWalking:           b.walking,
		IsDucking:           b.ducking,
		IsOnGround:          b.ground,
		Alive:               b.alive,
		HasBomb:             b.hasBomb,
		Health:              b.health,
		Armor:               b.armor,
		HasHelmet:           b.helmet,
		Money:               b.money,
		ActiveWeapon:        b.weapon,
		ActiveWeaponClass:   b.class,
		MainWeapon:          b.main,
		Flashbangs:          b.flash,
		Smokes:              b.smoke,
		HEGrenades:          b.he,
		FireGrenades:        b.fire,
		Decoys:              b.decoy,
	}
}

func (b *Builder) appendSample(sample Sample) {
	b.x = append(b.x, sample.X)
	b.y = append(b.y, sample.Y)
	b.z = append(b.z, sample.Z)
	b.yaw = append(b.yaw, sample.Yaw)
	b.pitch = append(b.pitch, sample.Pitch)
	b.eyeX = append(b.eyeX, sample.EyeX)
	b.eyeY = append(b.eyeY, sample.EyeY)
	b.eyeZ = append(b.eyeZ, sample.EyeZ)
	b.scoped = append(b.scoped, sample.IsScoped)
	b.zoom = append(b.zoom, sample.ZoomLevel)
	b.vmFov = append(b.vmFov, sample.ViewmodelFOV)
	b.vmX = append(b.vmX, sample.ViewmodelX)
	b.vmY = append(b.vmY, sample.ViewmodelY)
	b.vmZ = append(b.vmZ, sample.ViewmodelZ)
	b.recoil = append(b.recoil, sample.RecoilIndex)
	b.walking = append(b.walking, sample.IsWalking)
	b.ducking = append(b.ducking, sample.IsDucking)
	b.ground = append(b.ground, sample.IsOnGround)
	b.alive = append(b.alive, sample.Alive)
	b.hasBomb = append(b.hasBomb, sample.HasBomb)
	b.health = append(b.health, sample.Health)
	b.armor = append(b.armor, sample.Armor)
	b.helmet = append(b.helmet, sample.Helmet)
	b.money = append(b.money, sample.Money)
	b.weapon = append(b.weapon, sample.Weapon)
	b.class = append(b.class, sample.WeaponClass)
	b.main = append(b.main, sample.MainWeapon)
	b.flash = append(b.flash, sample.Flashbangs)
	b.smoke = append(b.smoke, sample.Smokes)
	b.he = append(b.he, sample.HEGrenades)
	b.fire = append(b.fire, sample.FireGrenades)
	b.decoy = append(b.decoy, sample.Decoys)
	b.lastTick = sample.Tick
	b.lastSample = sample
}
