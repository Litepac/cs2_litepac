package validate

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"

	"github.com/santhosh-tekuri/jsonschema/v6"

	"mastermind/parser/internal/replay"
)

const schemaResourceURL = "https://mastermind.local/schema/mastermind.replay.schema.json"

var schemaDefinitionNames = []string{
	"team",
	"player",
	"round",
	"playerStream",
	"trajectory",
	"blindEvent",
	"fireEvent",
	"hurtEvent",
	"killEvent",
	"bombEvent",
	"utilityEntity",
	"utilityPhaseEvent",
	"fireFootprintSample",
}

type compiledSchemas struct {
	root        *jsonschema.Schema
	definitions map[string]*jsonschema.Schema
}

func SchemaPath(explicit string) (string, error) {
	if explicit != "" {
		return explicit, nil
	}

	candidates := []string{
		filepath.Join("schema", "mastermind.replay.schema.json"),
		filepath.Join("..", "schema", "mastermind.replay.schema.json"),
		filepath.Join("..", "..", "schema", "mastermind.replay.schema.json"),
	}

	for _, candidate := range candidates {
		if _, err := os.Stat(candidate); err == nil {
			return candidate, nil
		}
	}

	return "", fmt.Errorf("could not locate schema/mastermind.replay.schema.json")
}

func ValidateSchema(path string, data replay.Replay) error {
	schemas, err := compileSchemas(path)
	if err != nil {
		return err
	}

	if err := validateReplaySchema(schemas, data); err != nil {
		return fmt.Errorf("schema validation failed: %w", err)
	}

	return nil
}

func compileSchemas(path string) (compiledSchemas, error) {
	rawSchema, err := os.ReadFile(path)
	if err != nil {
		return compiledSchemas{}, fmt.Errorf("read schema: %w", err)
	}

	var schemaDocument any
	if err := json.Unmarshal(rawSchema, &schemaDocument); err != nil {
		return compiledSchemas{}, fmt.Errorf("decode schema: %w", err)
	}

	compiler := jsonschema.NewCompiler()
	if err := compiler.AddResource(schemaResourceURL, schemaDocument); err != nil {
		return compiledSchemas{}, fmt.Errorf("add schema resource: %w", err)
	}

	root, err := compiler.Compile(schemaResourceURL)
	if err != nil {
		return compiledSchemas{}, fmt.Errorf("compile schema: %w", err)
	}

	definitions := make(map[string]*jsonschema.Schema, len(schemaDefinitionNames))
	for _, name := range schemaDefinitionNames {
		compiled, err := compiler.Compile(schemaResourceURL + "#/$defs/" + name)
		if err != nil {
			return compiledSchemas{}, fmt.Errorf("compile schema definition %s: %w", name, err)
		}
		definitions[name] = compiled
	}

	return compiledSchemas{
		root:        root,
		definitions: definitions,
	}, nil
}

func validateReplaySchema(schemas compiledSchemas, data replay.Replay) error {
	envelope := data
	envelope.Teams = []replay.Team{}
	envelope.Players = []replay.Player{}
	envelope.Rounds = []replay.Round{}
	if err := validateSchemaValue(schemas.root, "root", envelope); err != nil {
		return err
	}

	for index, team := range data.Teams {
		if err := validateSchemaDefinition(schemas, "team", fmt.Sprintf("teams[%d]", index), team); err != nil {
			return err
		}
	}
	for index, player := range data.Players {
		if err := validateSchemaDefinition(schemas, "player", fmt.Sprintf("players[%d]", index), player); err != nil {
			return err
		}
	}
	for roundIndex, round := range data.Rounds {
		if err := validateRoundSchema(schemas, roundIndex, round); err != nil {
			return err
		}
	}

	return nil
}

func validateRoundSchema(schemas compiledSchemas, roundIndex int, round replay.Round) error {
	path := fmt.Sprintf("rounds[%d]", roundIndex)
	envelope := round
	envelope.PlayerStreams = []replay.PlayerStream{}
	envelope.DroppedBombStream = nil
	envelope.BlindEvents = []replay.BlindEvent{}
	envelope.FireEvents = []replay.FireEvent{}
	envelope.HurtEvents = []replay.HurtEvent{}
	envelope.KillEvents = []replay.KillEvent{}
	envelope.BombEvents = []replay.BombEvent{}
	envelope.UtilityEntities = []replay.UtilityEntity{}
	if err := validateSchemaDefinition(schemas, "round", path, envelope); err != nil {
		return err
	}

	for index, stream := range round.PlayerStreams {
		if err := validatePlayerStreamSchema(schemas, fmt.Sprintf("%s.playerStreams[%d]", path, index), stream); err != nil {
			return err
		}
	}
	if round.DroppedBombStream != nil {
		if err := validateTrajectorySchema(schemas, path+".droppedBombStream", *round.DroppedBombStream); err != nil {
			return err
		}
	}
	for index, event := range round.BlindEvents {
		if err := validateSchemaDefinition(schemas, "blindEvent", fmt.Sprintf("%s.blindEvents[%d]", path, index), event); err != nil {
			return err
		}
	}
	for index, event := range round.FireEvents {
		if err := validateSchemaDefinition(schemas, "fireEvent", fmt.Sprintf("%s.fireEvents[%d]", path, index), event); err != nil {
			return err
		}
	}
	for index, event := range round.HurtEvents {
		if err := validateSchemaDefinition(schemas, "hurtEvent", fmt.Sprintf("%s.hurtEvents[%d]", path, index), event); err != nil {
			return err
		}
	}
	for index, event := range round.KillEvents {
		if err := validateSchemaDefinition(schemas, "killEvent", fmt.Sprintf("%s.killEvents[%d]", path, index), event); err != nil {
			return err
		}
	}
	for index, event := range round.BombEvents {
		if err := validateSchemaDefinition(schemas, "bombEvent", fmt.Sprintf("%s.bombEvents[%d]", path, index), event); err != nil {
			return err
		}
	}
	for index, utility := range round.UtilityEntities {
		if err := validateUtilitySchema(schemas, fmt.Sprintf("%s.utilityEntities[%d]", path, index), utility); err != nil {
			return err
		}
	}

	return nil
}

func validateUtilitySchema(schemas compiledSchemas, path string, utility replay.UtilityEntity) error {
	envelope := utility
	envelope.Trajectory = replay.Trajectory{
		SampleOriginTick:    utility.Trajectory.SampleOriginTick,
		SampleIntervalTicks: utility.Trajectory.SampleIntervalTicks,
		X:                   []*float64{},
		Y:                   []*float64{},
		Z:                   []*float64{},
	}
	envelope.PhaseEvents = []replay.UtilityPhaseEvent{}
	envelope.FireFootprint = []replay.FireFootprintSample{}
	if err := validateSchemaDefinition(schemas, "utilityEntity", path, envelope); err != nil {
		return err
	}
	if err := validateTrajectorySchema(schemas, path+".trajectory", utility.Trajectory); err != nil {
		return err
	}
	for index, event := range utility.PhaseEvents {
		if err := validateSchemaDefinition(schemas, "utilityPhaseEvent", fmt.Sprintf("%s.phaseEvents[%d]", path, index), event); err != nil {
			return err
		}
	}
	for index, sample := range utility.FireFootprint {
		if err := validateFireFootprintSchema(schemas, fmt.Sprintf("%s.fireFootprint[%d]", path, index), sample); err != nil {
			return err
		}
	}

	return nil
}

func validatePlayerStreamSchema(schemas compiledSchemas, path string, stream replay.PlayerStream) error {
	envelope := stream
	envelope.X = []*float64{}
	envelope.Y = []*float64{}
	envelope.Z = []*float64{}
	envelope.Yaw = []*float64{}
	envelope.Pitch = []*float64{}
	envelope.EyeX = []*float64{}
	envelope.EyeY = []*float64{}
	envelope.EyeZ = []*float64{}
	envelope.IsScoped = []*bool{}
	envelope.ZoomLevel = []*int{}
	envelope.ViewmodelFOV = []*float64{}
	envelope.ViewmodelOffsetX = []*float64{}
	envelope.ViewmodelOffsetY = []*float64{}
	envelope.ViewmodelOffsetZ = []*float64{}
	envelope.RecoilIndex = []*float64{}
	envelope.IsWalking = []*bool{}
	envelope.IsDucking = []*bool{}
	envelope.IsOnGround = []*bool{}
	envelope.Alive = []bool{}
	envelope.HasBomb = []bool{}
	envelope.Health = []*int{}
	envelope.Armor = []*int{}
	envelope.HasHelmet = []bool{}
	envelope.Money = []*int{}
	envelope.ActiveWeapon = []*string{}
	envelope.ActiveWeaponClass = []*string{}
	envelope.MainWeapon = []*string{}
	envelope.Flashbangs = []*int{}
	envelope.Smokes = []*int{}
	envelope.HEGrenades = []*int{}
	envelope.FireGrenades = []*int{}
	envelope.Decoys = []*int{}
	if err := validateSchemaDefinition(schemas, "playerStream", path, envelope); err != nil {
		return err
	}

	requiredArrays := []struct {
		name  string
		isNil bool
	}{
		{"x", stream.X == nil},
		{"y", stream.Y == nil},
		{"z", stream.Z == nil},
		{"yaw", stream.Yaw == nil},
		{"pitch", stream.Pitch == nil},
		{"eyeX", stream.EyeX == nil},
		{"eyeY", stream.EyeY == nil},
		{"eyeZ", stream.EyeZ == nil},
		{"isScoped", stream.IsScoped == nil},
		{"zoomLevel", stream.ZoomLevel == nil},
		{"viewmodelFov", stream.ViewmodelFOV == nil},
		{"viewmodelOffsetX", stream.ViewmodelOffsetX == nil},
		{"viewmodelOffsetY", stream.ViewmodelOffsetY == nil},
		{"viewmodelOffsetZ", stream.ViewmodelOffsetZ == nil},
		{"recoilIndex", stream.RecoilIndex == nil},
		{"isWalking", stream.IsWalking == nil},
		{"isDucking", stream.IsDucking == nil},
		{"isOnGround", stream.IsOnGround == nil},
		{"alive", stream.Alive == nil},
		{"hasBomb", stream.HasBomb == nil},
		{"health", stream.Health == nil},
		{"armor", stream.Armor == nil},
		{"hasHelmet", stream.HasHelmet == nil},
		{"money", stream.Money == nil},
		{"activeWeapon", stream.ActiveWeapon == nil},
		{"activeWeaponClass", stream.ActiveWeaponClass == nil},
		{"mainWeapon", stream.MainWeapon == nil},
		{"flashbangs", stream.Flashbangs == nil},
		{"smokes", stream.Smokes == nil},
		{"heGrenades", stream.HEGrenades == nil},
		{"fireGrenades", stream.FireGrenades == nil},
		{"decoys", stream.Decoys == nil},
	}
	for _, field := range requiredArrays {
		if field.isNil {
			return fmt.Errorf("%s.%s: value must be array, got null", path, field.name)
		}
	}

	floatArrays := []struct {
		name   string
		values []*float64
	}{
		{"x", stream.X},
		{"y", stream.Y},
		{"z", stream.Z},
		{"yaw", stream.Yaw},
		{"pitch", stream.Pitch},
		{"eyeX", stream.EyeX},
		{"eyeY", stream.EyeY},
		{"eyeZ", stream.EyeZ},
		{"viewmodelFov", stream.ViewmodelFOV},
		{"viewmodelOffsetX", stream.ViewmodelOffsetX},
		{"viewmodelOffsetY", stream.ViewmodelOffsetY},
		{"viewmodelOffsetZ", stream.ViewmodelOffsetZ},
		{"recoilIndex", stream.RecoilIndex},
	}
	for _, field := range floatArrays {
		if err := validateNullableNumbers(path+"."+field.name, field.values); err != nil {
			return err
		}
	}

	validWeaponClasses := map[string]struct{}{
		"pistol":    {},
		"smg":       {},
		"heavy":     {},
		"rifle":     {},
		"sniper":    {},
		"knife":     {},
		"utility":   {},
		"equipment": {},
		"unknown":   {},
	}
	for index, value := range stream.ActiveWeaponClass {
		if value == nil {
			continue
		}
		if _, ok := validWeaponClasses[*value]; !ok {
			return fmt.Errorf("%s.activeWeaponClass[%d]: value %q is not an allowed weapon class", path, index, *value)
		}
	}

	return nil
}

func validateTrajectorySchema(schemas compiledSchemas, path string, trajectory replay.Trajectory) error {
	envelope := trajectory
	envelope.X = []*float64{}
	envelope.Y = []*float64{}
	envelope.Z = []*float64{}
	if err := validateSchemaDefinition(schemas, "trajectory", path, envelope); err != nil {
		return err
	}
	if trajectory.X == nil || trajectory.Y == nil || trajectory.Z == nil {
		return fmt.Errorf("%s: coordinate streams must be arrays, not null", path)
	}
	if err := validateNullableNumbers(path+".x", trajectory.X); err != nil {
		return err
	}
	if err := validateNullableNumbers(path+".y", trajectory.Y); err != nil {
		return err
	}
	return validateNullableNumbers(path+".z", trajectory.Z)
}

func validateFireFootprintSchema(schemas compiledSchemas, path string, sample replay.FireFootprintSample) error {
	envelope := sample
	envelope.X = []*float64{}
	envelope.Y = []*float64{}
	envelope.Z = []*float64{}
	if err := validateSchemaDefinition(schemas, "fireFootprintSample", path, envelope); err != nil {
		return err
	}
	if sample.X == nil || sample.Y == nil || sample.Z == nil {
		return fmt.Errorf("%s: coordinate streams must be arrays, not null", path)
	}
	if err := validateNullableNumbers(path+".x", sample.X); err != nil {
		return err
	}
	if err := validateNullableNumbers(path+".y", sample.Y); err != nil {
		return err
	}
	return validateNullableNumbers(path+".z", sample.Z)
}

func validateNullableNumbers(path string, values []*float64) error {
	for index, value := range values {
		if value != nil && (math.IsNaN(*value) || math.IsInf(*value, 0)) {
			return fmt.Errorf("%s[%d]: value must be a finite JSON number", path, index)
		}
	}
	return nil
}

func validateSchemaDefinition(schemas compiledSchemas, definition string, path string, data any) error {
	compiled, ok := schemas.definitions[definition]
	if !ok {
		return fmt.Errorf("%s: schema definition %s is not compiled", path, definition)
	}
	return validateSchemaValue(compiled, path, data)
}

func validateSchemaValue(compiled *jsonschema.Schema, path string, data any) error {
	raw, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("%s: marshal for schema validation: %w", path, err)
	}

	var value any
	if err := json.Unmarshal(raw, &value); err != nil {
		return fmt.Errorf("%s: decode for schema validation: %w", path, err)
	}

	if err := compiled.Validate(value); err != nil {
		return fmt.Errorf("%s: %w", path, err)
	}

	return nil
}
